import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { QUEUE_NAMES } from '@hubmarket/queues';
import { MarketplaceType, CanonicalProduct, ProductMarketplaceMapping } from '@hubmarket/core';
import { OutboundSyncService, OutboundSyncJobData } from './outbound-sync.service';
import { TransformerFactory } from '../shared/transformers/transformer.factory';
import {
  WildberriesClient,
  OzonClient,
  YandexMarketClient,
  WBPriceUpdate,
  OzonPriceUpdate,
  YandexPriceUpdate,
} from '@hubmarket/marketplace-clients';

type PriceUpdate = WBPriceUpdate | OzonPriceUpdate | YandexPriceUpdate;

@Processor(QUEUE_NAMES.SYNC_OUTBOUND_PRICES, {
  concurrency: 2,
})
export class OutboundPricesWorker extends WorkerHost {
  private readonly logger = new Logger(OutboundPricesWorker.name);

  constructor(
    private readonly outboundSyncService: OutboundSyncService,
    private readonly transformerFactory: TransformerFactory,
  ) {
    super();
  }

  async process(job: Job<OutboundSyncJobData>): Promise<void> {
    const { syncJobId, marketplaceAccountId, organizationId, marketplace, productIds } = job.data;

    this.logger.log(`Starting outbound prices sync to ${marketplace}, job: ${syncJobId}`);

    try {
      await this.outboundSyncService.updateSyncJobProgress(syncJobId, {
        status: 'processing',
      });

      const account = await this.outboundSyncService.getAccountWithCredentials(marketplaceAccountId);
      if (!account) {
        throw new Error(`Account not found: ${marketplaceAccountId}`);
      }

      const client = this.createClient(marketplace, account.credentials);
      const transformer = this.transformerFactory.getTransformer(marketplace);

      const productsToSync = await this.outboundSyncService.getProductsToSync(
        organizationId,
        marketplaceAccountId,
        productIds,
      );

      // Filter products that have mappings with externalId (already exist on this marketplace)
      const productsWithMappings = productsToSync.filter((p) => p.mapping && p.mapping.externalId);

      let successCount = 0;
      let failedCount = 0;
      const errors: Array<{ sku: string; error: string }> = [];

      // Process in batches
      const batchSize = this.getBatchSize(marketplace);
      for (let i = 0; i < productsWithMappings.length; i += batchSize) {
        const batch = productsWithMappings.slice(i, i + batchSize);

        const priceUpdates: PriceUpdate[] = batch.map(({ product, mapping }) =>
          transformer.toPriceUpdate(product, mapping!.externalId!),
        );

        try {
          await this.sendPriceUpdates(client, marketplace, priceUpdates);

          // Update mappings on success
          for (const { product, mapping } of batch) {
            await this.outboundSyncService.updateMappingAfterSync(mapping!.id, {
              currentPrice: product.basePrice,
              syncStatus: 'synced',
            });
            successCount++;
          }
        } catch (error) {
          // Log error but continue with next batch
          for (const { product, mapping } of batch) {
            await this.outboundSyncService.updateMappingAfterSync(mapping!.id, {
              syncStatus: 'error',
              lastError: error instanceof Error ? error.message : String(error),
            });
            failedCount++;
            errors.push({
              sku: product.internalSku,
              error: error instanceof Error ? error.message : String(error),
            });
          }
          this.logger.error(`Batch price update failed:`, error);
        }

        await job.updateProgress({
          processed: i + batch.length,
          total: productsWithMappings.length,
        });
      }

      await this.outboundSyncService.updateSyncJobProgress(syncJobId, {
        status: failedCount > 0 && successCount === 0 ? 'failed' : 'completed',
        processedItems: productsWithMappings.length,
        successItems: successCount,
        failedItems: failedCount,
        errors: errors.length > 0 ? errors.slice(0, 100) : undefined,
      });

      this.logger.log(
        `Completed outbound prices sync to ${marketplace}: ${successCount} success, ${failedCount} failed`,
      );
    } catch (error) {
      this.logger.error(`Outbound prices sync failed:`, error);

      await this.outboundSyncService.updateSyncJobProgress(syncJobId, {
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

  private async sendPriceUpdates(
    client: WildberriesClient | OzonClient | YandexMarketClient,
    marketplace: MarketplaceType,
    updates: PriceUpdate[],
  ): Promise<void> {
    switch (marketplace) {
      case 'wildberries': {
        const wbClient = client as WildberriesClient;
        await wbClient.updatePrices(updates as WBPriceUpdate[]);
        break;
      }

      case 'ozon': {
        const ozonClient = client as OzonClient;
        await ozonClient.updatePrices(updates as OzonPriceUpdate[]);
        break;
      }

      case 'yandex_market': {
        const ymClient = client as YandexMarketClient;
        await ymClient.updatePrices(updates as YandexPriceUpdate[]);
        break;
      }

      default:
        throw new Error(`Unknown marketplace: ${marketplace}`);
    }
  }

  private getBatchSize(marketplace: MarketplaceType): number {
    switch (marketplace) {
      case 'wildberries':
        return 1000; // WB allows up to 1000 items per request
      case 'ozon':
        return 100; // Ozon allows up to 100 items per request
      case 'yandex_market':
        return 200; // YM recommended batch size
      default:
        return 50;
    }
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job<OutboundSyncJobData>) {
    this.logger.log(`Job ${job.id} completed for sync job ${job.data.syncJobId}`);
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job<OutboundSyncJobData>, error: Error) {
    this.logger.error(`Job ${job.id} failed: ${error.message}`);
  }
}
