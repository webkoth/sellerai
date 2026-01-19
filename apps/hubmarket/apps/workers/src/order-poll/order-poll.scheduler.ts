import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { OrderPollService } from './order-poll.service';
import { StockSyncService } from '../stock-sync/stock-sync.service';

/**
 * Scheduler for periodic order polling
 *
 * Responsibilities:
 * 1. Poll orders from all marketplaces periodically
 * 2. Recover orders that failed stock update
 * 3. Health check for order polling system
 */
@Injectable()
export class OrderPollScheduler implements OnModuleInit {
  private readonly logger = new Logger(OrderPollScheduler.name);
  private isPolling = false;

  constructor(
    private readonly orderPollService: OrderPollService,
    private readonly stockSyncService: StockSyncService,
  ) {}

  async onModuleInit() {
    this.logger.log('Order poll scheduler initialized');
    // Initial poll on startup (with delay to let system stabilize)
    setTimeout(() => this.pollAllOrders(), 10000);
  }

  /**
   * Poll orders from all marketplaces every 5 minutes
   */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async pollAllOrders(): Promise<void> {
    if (this.isPolling) {
      this.logger.warn('Order polling already in progress, skipping...');
      return;
    }

    this.isPolling = true;
    this.logger.log('Starting scheduled order poll for all marketplaces');

    try {
      const accounts = await this.orderPollService.getAllActiveAccounts();
      this.logger.log(`Found ${accounts.length} active marketplace accounts`);

      for (const account of accounts) {
        try {
          await this.orderPollService.queueOrderPoll(account);
          this.logger.debug(`Queued order poll for ${account.marketplace} (${account.id})`);
        } catch (error) {
          this.logger.error(
            `Failed to queue order poll for ${account.marketplace}:`,
            error,
          );
        }
      }
    } catch (error) {
      this.logger.error('Failed to poll orders:', error);
    } finally {
      this.isPolling = false;
    }
  }

  /**
   * Recover orders that failed stock update - run every 15 minutes
   */
  @Cron(CronExpression.EVERY_30_MINUTES)
  async recoverFailedStockUpdates(): Promise<void> {
    this.logger.log('Checking for orders with failed stock updates');

    try {
      const orders = await this.orderPollService.getOrdersNeedingStockUpdate(50);

      if (orders.length === 0) {
        this.logger.debug('No orders needing stock update recovery');
        return;
      }

      this.logger.log(`Found ${orders.length} orders needing stock update recovery`);

      for (const order of orders) {
        try {
          // Re-process each item in the order
          const items = order.items as Array<{ sku: string; quantity: number }>;

          for (const item of items) {
            let canonicalProduct = await this.orderPollService.findCanonicalProductBySku(
              order.marketplaceAccountId,
              item.sku,
            );

            // Fallback: try barcode (WB orders contain barcodes)
            if (!canonicalProduct) {
              canonicalProduct = await this.orderPollService.findCanonicalProductByBarcode(
                order.organizationId,
                item.sku,
              );
            }

            if (canonicalProduct) {
              await this.stockSyncService.queueStockUpdateFromOrder(
                order,
                canonicalProduct.id,
                item.quantity,
              );
            }
          }

          this.logger.debug(`Recovered stock update for order ${order.externalOrderId}`);
        } catch (error) {
          this.logger.error(
            `Failed to recover stock update for order ${order.externalOrderId}:`,
            error,
          );
        }
      }
    } catch (error) {
      this.logger.error('Failed to recover stock updates:', error);
    }
  }

  /**
   * Log system health every hour
   */
  @Cron(CronExpression.EVERY_HOUR)
  async logHealthStatus(): Promise<void> {
    try {
      const accounts = await this.orderPollService.getAllActiveAccounts();
      const ordersNeedingUpdate = await this.orderPollService.getOrdersNeedingStockUpdate(1000);

      this.logger.log(
        `Order poll health: accounts=${accounts.length}, pendingStockUpdates=${ordersNeedingUpdate.length}`,
      );
    } catch (error) {
      this.logger.error('Health check failed:', error);
    }
  }
}
