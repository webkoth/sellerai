import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { QUEUE_NAMES } from '@hubmarket/queues';
import { MarketplaceType } from '@hubmarket/core';
import { OrderPollService, OrderPollJobData, OrderItem } from './order-poll.service';
import { StockSyncService } from '../stock-sync/stock-sync.service';
import {
  WildberriesClient,
  OzonClient,
  YandexMarketClient,
} from '@hubmarket/marketplace-clients';

interface RawOrder {
  id: string;
  status: string;
  items: OrderItem[];
  createdAt?: Date;
}

@Processor(QUEUE_NAMES.ORDER_POLL, {
  concurrency: 3,
})
export class OrderPollWorker extends WorkerHost {
  private readonly logger = new Logger(OrderPollWorker.name);

  constructor(
    private readonly orderPollService: OrderPollService,
    private readonly stockSyncService: StockSyncService,
  ) {
    super();
  }

  async process(job: Job<OrderPollJobData>): Promise<void> {
    const { marketplaceAccountId, organizationId, marketplace, lastPollTime } = job.data;

    this.logger.log(`Polling orders from ${marketplace}, account: ${marketplaceAccountId}`);

    try {
      const account = await this.orderPollService.getAccountWithCredentials(marketplaceAccountId);
      if (!account) {
        throw new Error(`Account not found: ${marketplaceAccountId}`);
      }

      const client = this.createClient(marketplace, account.credentials);

      // Fetch new orders since last poll
      const dateFrom = lastPollTime ? new Date(lastPollTime) : new Date(Date.now() - 24 * 60 * 60 * 1000);
      const orders = await this.fetchNewOrders(client, marketplace, dateFrom);

      this.logger.log(`Found ${orders.length} orders from ${marketplace}`);

      let processedCount = 0;
      let stockUpdatesQueued = 0;

      for (const rawOrder of orders) {
        try {
          // Save/update order in database
          const { order, isNew } = await this.orderPollService.upsertOrder(
            organizationId,
            marketplaceAccountId,
            rawOrder.id,
            rawOrder.status,
            rawOrder.items,
          );

          // Only queue stock updates for new orders that aren't already processed
          if (isNew && !order.stockUpdated && this.shouldUpdateStock(rawOrder.status)) {
            // Process each order item
            for (const item of rawOrder.items) {
              // Find canonical product by SKU
              let canonicalProduct = await this.orderPollService.findCanonicalProductBySku(
                marketplaceAccountId,
                item.sku,
              );

              // Fallback: try internal SKU
              if (!canonicalProduct) {
                canonicalProduct = await this.orderPollService.findCanonicalProductByInternalSku(
                  organizationId,
                  item.sku,
                );
              }

              // Fallback: try barcode (WB orders contain barcodes, not vendorCodes)
              if (!canonicalProduct) {
                canonicalProduct = await this.orderPollService.findCanonicalProductByBarcode(
                  organizationId,
                  item.sku,
                );
              }

              if (canonicalProduct) {
                // Queue stock update (bidirectional - will update ALL marketplaces)
                await this.stockSyncService.queueStockUpdateFromOrder(
                  order,
                  canonicalProduct.id,
                  item.quantity,
                );
                stockUpdatesQueued++;
              } else {
                this.logger.warn(
                  `Cannot find product for SKU ${item.sku} in order ${rawOrder.id}`,
                );
              }
            }
          }

          processedCount++;
        } catch (error) {
          this.logger.error(
            `Failed to process order ${rawOrder.id}:`,
            error,
          );
        }

        await job.updateProgress({
          processed: processedCount,
          total: orders.length,
        });
      }

      // Update last poll time
      await this.orderPollService.updateLastPollTime(marketplaceAccountId, new Date());

      this.logger.log(
        `Order poll completed for ${marketplace}: processed=${processedCount}, stockUpdates=${stockUpdatesQueued}`,
      );
    } catch (error) {
      this.logger.error(`Order poll failed for ${marketplace}:`, error);
      throw error;
    }
  }

  private createClient(
    marketplace: MarketplaceType,
    credentials: Record<string, unknown>,
  ): WildberriesClient | OzonClient | YandexMarketClient {
    switch (marketplace) {
      case 'wildberries':
        return new WildberriesClient(
          { token: (credentials.token || credentials.apiKey) as string },
          'marketplace', // Orders API requires marketplace base URL
        );
      case 'ozon':
        return new OzonClient({
          clientId: credentials.clientId as string,
          apiKey: credentials.apiKey as string,
        });
      case 'yandex_market':
        return new YandexMarketClient({
          oauthToken: (credentials.oauthToken || credentials.apiKey) as string,
          businessId: Number(credentials.businessId),
          campaignId: Number(credentials.campaignId),
        });
      default:
        throw new Error(`Unknown marketplace: ${marketplace}`);
    }
  }

  private async fetchNewOrders(
    client: WildberriesClient | OzonClient | YandexMarketClient,
    marketplace: MarketplaceType,
    dateFrom: Date,
  ): Promise<RawOrder[]> {
    switch (marketplace) {
      case 'wildberries': {
        const wbClient = client as WildberriesClient;
        const response = await wbClient.getNewOrders({
          dateFrom: dateFrom.getTime(),
        });

        return (response.orders || []).map((order) => ({
          id: String(order.id),
          status: 'new', // WB new orders endpoint returns only new orders
          items: (order.skus || []).map((sku) => ({
            sku,
            quantity: 1, // WB orders are typically 1 item per SKU line
            price: order.price,
          })),
          createdAt: order.createdAt ? new Date(order.createdAt) : undefined,
        }));
      }

      case 'ozon': {
        const ozonClient = client as OzonClient;
        const response = await ozonClient.getOrdersFBS({
          filter: {
            since: dateFrom.toISOString(),
            to: new Date().toISOString(),
            status: 'awaiting_packaging', // New orders awaiting processing
          },
          limit: 100,
        });

        return (response.result?.postings || []).map((posting) => ({
          id: posting.posting_number,
          status: posting.status,
          items: (posting.products || []).map((product) => ({
            sku: product.offer_id,
            quantity: product.quantity,
            price: parseFloat(product.price) || 0,
          })),
        }));
      }

      case 'yandex_market': {
        const ymClient = client as YandexMarketClient;
        // Yandex expects date in YYYY-MM-DD format
        const fromDateStr = dateFrom.toISOString().split('T')[0];
        const response = await ymClient.getOrders({
          status: 'PROCESSING',
          fromDate: fromDateStr,
        });

        return (response.result?.orders || []).map((order) => ({
          id: String(order.id),
          status: order.status,
          items: (order.items || []).map((item) => ({
            sku: item.offerId,
            quantity: item.count,
            price: item.price,
          })),
        }));
      }

      default:
        throw new Error(`Unknown marketplace: ${marketplace}`);
    }
  }

  /**
   * Determine if order status requires stock update
   */
  private shouldUpdateStock(status: string): boolean {
    // Update stock for orders that are confirmed/processing
    const stockUpdateStatuses = [
      // WB
      'new',
      'confirm',
      'complete',
      // Ozon
      'awaiting_packaging',
      'awaiting_deliver',
      'delivering',
      // Yandex
      'PROCESSING',
      'DELIVERY',
    ];

    return stockUpdateStatuses.some(
      (s) => status.toLowerCase().includes(s.toLowerCase()),
    );
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job<OrderPollJobData>) {
    this.logger.debug(
      `Order poll job completed: ${job.id}, marketplace=${job.data.marketplace}`,
    );
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job<OrderPollJobData>, error: Error) {
    this.logger.error(
      `Order poll job failed: ${job.id}, marketplace=${job.data.marketplace}, error=${error.message}`,
    );
  }
}
