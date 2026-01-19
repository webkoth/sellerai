import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { QUEUE_NAMES } from '@hubmarket/queues';
import { StockSyncService, StockUpdateJobData } from './stock-sync.service';

/**
 * Stock Sync Worker - handles bidirectional stock synchronization
 *
 * Flow:
 * 1. Order created on any marketplace (WB, Ozon, YM)
 * 2. Order polling worker detects the order
 * 3. Creates a stock update job with delta = -quantity
 * 4. This worker processes the job:
 *    - Checks idempotency (prevent duplicate processing)
 *    - Updates canonical stock in PostgreSQL
 *    - Creates audit event
 *    - Fans out stock updates to ALL marketplaces
 * 5. Each marketplace queue (rate-limited) sends the actual API update
 */
@Processor(QUEUE_NAMES.ORDERS_STOCK_UPDATE, {
  concurrency: 5,
})
export class StockSyncWorker extends WorkerHost {
  private readonly logger = new Logger(StockSyncWorker.name);

  constructor(private readonly stockSyncService: StockSyncService) {
    super();
  }

  async process(job: Job<StockUpdateJobData>): Promise<void> {
    const {
      canonicalProductId,
      organizationId,
      delta,
      sourceMarketplaceAccountId,
      sourceOrderId,
      reason,
      idempotencyKey,
    } = job.data;

    this.logger.log(
      `Processing stock update: product=${canonicalProductId}, delta=${delta}, reason=${reason}`,
    );

    try {
      // 1. Idempotency check - prevent duplicate processing
      const alreadyProcessed = await this.stockSyncService.isStockUpdateProcessed(idempotencyKey);
      if (alreadyProcessed) {
        this.logger.log(`Stock update already processed: ${idempotencyKey}`);
        return;
      }

      // 2. Update canonical stock atomically (with row lock)
      const newStock = await this.stockSyncService.updateCanonicalStock(
        canonicalProductId,
        delta,
      );

      this.logger.log(
        `Updated canonical stock: product=${canonicalProductId}, newStock=${newStock}`,
      );

      // 3. Create audit event
      const stockEvent = await this.stockSyncService.createStockSyncEvent({
        canonicalProductId,
        sourceMarketplaceAccountId: sourceMarketplaceAccountId || null,
        sourceOrderId: sourceOrderId || null,
        delta,
        reason,
        syncedTo: [], // Will be updated as marketplaces are synced
      });

      // 4. Get ALL active marketplace accounts for the organization
      const accounts = await this.stockSyncService.getAllActiveAccounts(organizationId);

      if (accounts.length === 0) {
        this.logger.warn(`No active marketplace accounts for org: ${organizationId}`);
        return;
      }

      // 5. Calculate effective stock (considering safety buffer)
      const effectiveStock = await this.stockSyncService.calculateEffectiveStock(
        canonicalProductId,
      );

      // 6. Fan-out: Queue stock update to ALL marketplaces
      type SyncStatus = 'pending' | 'success' | 'failed';
      const syncResults: Array<{ accountId: string; status: SyncStatus; error?: string }> = [];

      for (const account of accounts) {
        try {
          // Get product mapping for this marketplace
          const mapping = await this.stockSyncService.getProductMapping(
            canonicalProductId,
            account.id,
          );

          if (!mapping) {
            this.logger.debug(
              `No mapping for product ${canonicalProductId} on account ${account.id}`,
            );
            syncResults.push({
              accountId: account.id,
              status: 'failed',
              error: 'No product mapping',
            });
            continue;
          }

          // Queue the marketplace-specific stock update
          // Get default warehouse ID from warehouseMappings if available
          const warehouseId = account.settings?.warehouseMappings
            ? Object.values(account.settings.warehouseMappings)[0]
            : undefined;
          await this.stockSyncService.queueMarketplaceStockUpdate(
            account,
            canonicalProductId,
            effectiveStock,
            // Pass warehouse ID if available (for FBS/FBO scenarios)
            warehouseId,
          );

          // Update the mapping's current stock
          await this.stockSyncService.updateMappingStock(mapping.id, effectiveStock);

          syncResults.push({
            accountId: account.id,
            status: 'pending', // Will become 'success' when marketplace queue processes it
          });

          this.logger.debug(
            `Queued stock update to ${account.marketplace}: account=${account.id}, stock=${effectiveStock}`,
          );
        } catch (error) {
          this.logger.error(
            `Failed to queue stock update for account ${account.id}:`,
            error,
          );
          syncResults.push({
            accountId: account.id,
            status: 'failed',
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }

      // 7. Update audit event with sync results
      await this.stockSyncService.updateStockSyncEvent(stockEvent.id, syncResults);

      // 8. Mark source order as stock-updated (if from order)
      if (sourceOrderId) {
        await this.stockSyncService.markOrderStockUpdated(sourceOrderId);
      }

      this.logger.log(
        `Stock sync completed: product=${canonicalProductId}, newStock=${newStock}, ` +
          `accounts=${accounts.length}, pending=${syncResults.filter((r) => r.status === 'pending').length}`,
      );
    } catch (error) {
      this.logger.error(
        `Stock sync failed: product=${canonicalProductId}, error=${error}`,
      );
      throw error;
    }
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job<StockUpdateJobData>) {
    this.logger.debug(
      `Stock sync job completed: ${job.id}, product=${job.data.canonicalProductId}`,
    );
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job<StockUpdateJobData>, error: Error) {
    this.logger.error(
      `Stock sync job failed: ${job.id}, product=${job.data.canonicalProductId}, error=${error.message}`,
    );
  }
}
