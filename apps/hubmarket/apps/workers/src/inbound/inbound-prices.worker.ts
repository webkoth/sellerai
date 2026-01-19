import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Job } from 'bullmq';
import { QUEUE_NAMES } from '@hubmarket/queues';
import {
  MarketplaceType,
  CanonicalProduct,
  ProductMarketplaceMapping,
} from '@hubmarket/core';
import { InboundSyncService, InboundSyncJobData } from './inbound-sync.service';
import {
  WildberriesClient,
  OzonClient,
  YandexMarketClient,
} from '@hubmarket/marketplace-clients';

interface PriceData {
  externalId: string;
  price: number;
  oldPrice?: number;
  minPrice?: number;
}

@Processor(QUEUE_NAMES.SYNC_INBOUND_PRICES, {
  concurrency: 2,
})
export class InboundPricesWorker extends WorkerHost {
  private readonly logger = new Logger(InboundPricesWorker.name);

  constructor(
    private readonly inboundSyncService: InboundSyncService,
    @InjectRepository(CanonicalProduct)
    private readonly productRepo: Repository<CanonicalProduct>,
    @InjectRepository(ProductMarketplaceMapping)
    private readonly mappingRepo: Repository<ProductMarketplaceMapping>,
  ) {
    super();
  }

  async process(job: Job<InboundSyncJobData>): Promise<void> {
    const { syncJobId, marketplaceAccountId, organizationId, marketplace } = job.data;

    this.logger.log(`Starting inbound prices sync for ${marketplace}, job: ${syncJobId}`);

    try {
      await this.inboundSyncService.updateSyncJobProgress(syncJobId, {
        status: 'processing',
      });

      const account = await this.inboundSyncService.getAccountWithCredentials(marketplaceAccountId);
      if (!account) {
        throw new Error(`Account not found: ${marketplaceAccountId}`);
      }

      const client = this.createClient(marketplace, account.credentials);

      // Get all mappings for this account
      const mappings = await this.mappingRepo.find({
        where: { marketplaceAccountId },
        relations: ['canonicalProduct'],
      });

      if (mappings.length === 0) {
        this.logger.log('No product mappings found, skipping price sync');
        await this.inboundSyncService.updateSyncJobProgress(syncJobId, {
          status: 'completed',
          processedItems: 0,
          successItems: 0,
        });
        return;
      }

      const externalIds = mappings.map((m) => m.externalId).filter((id): id is string => id !== null);
      const prices = await this.fetchPrices(client, marketplace, externalIds);

      let successCount = 0;
      let failedCount = 0;
      const errors: Array<{ sku: string; error: string }> = [];

      for (const priceData of prices) {
        try {
          const mapping = mappings.find((m) => m.externalId === priceData.externalId);
          if (!mapping) continue;

          // Update mapping's current price
          mapping.currentPrice = priceData.price;
          mapping.lastSyncAt = new Date();
          await this.mappingRepo.save(mapping);

          // Update canonical product's base price (from master)
          if (mapping.canonicalProduct) {
            await this.productRepo.update(mapping.canonicalProduct.id, {
              basePrice: priceData.price,
              minPrice: priceData.minPrice,
              updatedAt: new Date(),
            });
          }

          successCount++;
        } catch (error) {
          failedCount++;
          errors.push({
            sku: priceData.externalId,
            error: error instanceof Error ? error.message : String(error),
          });
          this.logger.error(`Failed to update price for ${priceData.externalId}:`, error);
        }
      }

      await this.inboundSyncService.updateSyncJobProgress(syncJobId, {
        status: failedCount > 0 && successCount === 0 ? 'failed' : 'completed',
        processedItems: prices.length,
        successItems: successCount,
        failedItems: failedCount,
        errors: errors.length > 0 ? errors.slice(0, 100) : undefined,
      });

      this.logger.log(
        `Completed inbound prices sync: ${successCount} success, ${failedCount} failed`,
      );
    } catch (error) {
      this.logger.error(`Inbound prices sync failed:`, error);

      await this.inboundSyncService.updateSyncJobProgress(syncJobId, {
        status: 'failed',
        errors: [{ sku: '', error: error instanceof Error ? error.message : String(error) }],
      });

      throw error;
    }
  }

  private createClient(
    marketplace: MarketplaceType,
    credentials: Record<string, unknown>,
  ): WildberriesClient | OzonClient | YandexMarketClient {
    switch (marketplace) {
      case 'wildberries':
        return new WildberriesClient({
          token: (credentials.token || credentials.apiKey) as string,
        });
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

  private async fetchPrices(
    client: WildberriesClient | OzonClient | YandexMarketClient,
    marketplace: MarketplaceType,
    externalIds: string[],
  ): Promise<PriceData[]> {
    switch (marketplace) {
      case 'wildberries': {
        const wbClient = client as WildberriesClient;
        // WB prices come from product cards or dedicated prices API
        const response = await wbClient.getProductsWithPrices({ limit: 1000 });
        return (response.data?.listGoods || []).map((item) => ({
          externalId: String(item.nmID),
          price: item.sizes?.[0]?.discountedPrice || item.sizes?.[0]?.price || 0,
        }));
      }

      case 'ozon': {
        const ozonClient = client as OzonClient;
        const productIds = externalIds.map((id) => parseInt(id, 10)).filter((id) => !isNaN(id));
        if (productIds.length === 0) return [];

        const response = await ozonClient.getProductsInfo({ product_id: productIds });
        return (response.result?.items || []).map((item) => ({
          externalId: String(item.id),
          price: parseFloat(item.price) || 0,
          oldPrice: item.old_price ? parseFloat(item.old_price) : undefined,
        }));
      }

      case 'yandex_market': {
        const ymClient = client as YandexMarketClient;
        const response = await ymClient.getOfferMappings({
          offerIds: externalIds,
        });
        return (response.result?.offerMappings || []).map((mapping: { offer: { offerId: string; basicPrice?: { value: number } } }) => ({
          externalId: mapping.offer.offerId,
          price: mapping.offer.basicPrice?.value || 0,
        }));
      }

      default:
        throw new Error(`Unknown marketplace: ${marketplace}`);
    }
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job<InboundSyncJobData>) {
    this.logger.log(`Job ${job.id} completed for sync job ${job.data.syncJobId}`);
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job<InboundSyncJobData>, error: Error) {
    this.logger.error(`Job ${job.id} failed: ${error.message}`);
  }
}
