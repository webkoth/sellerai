import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { QUEUE_NAMES } from '@hubmarket/queues';
import { MarketplaceType } from '@hubmarket/core';
import { OutboundSyncService, OutboundSyncJobData } from './outbound-sync.service';
import { TransformerFactory } from '../shared/transformers/transformer.factory';
import {
  WildberriesClient,
  OzonClient,
  YandexMarketClient,
  WBProduct,
  OzonProduct,
  YandexOffer,
} from '@hubmarket/marketplace-clients';

type MarketplaceProduct = WBProduct | OzonProduct | YandexOffer;

@Processor(QUEUE_NAMES.SYNC_OUTBOUND_PRODUCTS, {
  concurrency: 2,
})
export class OutboundProductsWorker extends WorkerHost {
  private readonly logger = new Logger(OutboundProductsWorker.name);

  constructor(
    private readonly outboundSyncService: OutboundSyncService,
    private readonly transformerFactory: TransformerFactory,
  ) {
    super();
  }

  async process(job: Job<OutboundSyncJobData>): Promise<void> {
    const { syncJobId, marketplaceAccountId, organizationId, marketplace, productIds } = job.data;

    this.logger.log(`Starting outbound products sync to ${marketplace}, job: ${syncJobId}`);

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

      let successCount = 0;
      let failedCount = 0;
      const errors: Array<{ sku: string; error: string }> = [];

      // Process each product
      for (let i = 0; i < productsToSync.length; i++) {
        const { product, mapping } = productsToSync[i];

        try {
          const mpProduct = transformer.fromCanonical(product);

          if (mapping && mapping.externalId) {
            // Update existing product
            await this.updateProduct(client, marketplace, mpProduct, mapping.externalId);

            await this.outboundSyncService.updateMappingAfterSync(mapping.id, {
              syncStatus: 'synced',
            });
          } else {
            // Create new product on marketplace
            const result = await this.createProduct(client, marketplace, mpProduct);

            // Create mapping with the returned external ID
            await this.outboundSyncService.upsertMapping(
              product.id,
              marketplaceAccountId,
              {
                externalId: result.externalId,
                externalSku: product.internalSku,
                marketplaceData: result.marketplaceData,
                syncStatus: 'synced',
              },
            );
          }

          successCount++;
        } catch (error) {
          failedCount++;
          errors.push({
            sku: product.internalSku,
            error: error instanceof Error ? error.message : String(error),
          });

          if (mapping) {
            await this.outboundSyncService.updateMappingAfterSync(mapping.id, {
              syncStatus: 'error',
              lastError: error instanceof Error ? error.message : String(error),
            });
          }

          this.logger.error(`Failed to sync product ${product.internalSku}:`, error);
        }

        await job.updateProgress({
          processed: i + 1,
          total: productsToSync.length,
        });
      }

      await this.outboundSyncService.updateSyncJobProgress(syncJobId, {
        status: failedCount > 0 && successCount === 0 ? 'failed' : 'completed',
        processedItems: productsToSync.length,
        successItems: successCount,
        failedItems: failedCount,
        errors: errors.length > 0 ? errors.slice(0, 100) : undefined,
      });

      this.logger.log(
        `Completed outbound products sync to ${marketplace}: ${successCount} success, ${failedCount} failed`,
      );
    } catch (error) {
      this.logger.error(`Outbound products sync failed:`, error);

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

  private async createProduct(
    client: WildberriesClient | OzonClient | YandexMarketClient,
    marketplace: MarketplaceType,
    product: MarketplaceProduct,
  ): Promise<{ externalId: string; marketplaceData: Record<string, unknown> }> {
    switch (marketplace) {
      case 'wildberries': {
        // WB creates cards asynchronously, we'd need to poll for result
        // For now, return a placeholder - in real implementation, handle async flow
        this.logger.warn('WB product creation is async - implement polling');
        return {
          externalId: '0', // Will be updated after async creation
          marketplaceData: { vendorCode: (product as WBProduct).vendorCode },
        };
      }

      case 'ozon': {
        const ozonClient = client as OzonClient;
        const ozonProduct = product as OzonProduct;
        // Convert OzonProduct to import format (attribute_id -> id)
        const importItem = {
          offer_id: ozonProduct.offer_id,
          name: ozonProduct.name,
          barcode: ozonProduct.barcode,
          price: ozonProduct.price,
          images: ozonProduct.images,
          attributes: ozonProduct.attributes?.map((attr) => ({
            id: attr.attribute_id,
            complex_id: attr.complex_id,
            values: attr.values || [],
          })),
        };
        const result = await ozonClient.importProducts([importItem]);
        // Ozon returns task_id, need to poll for result
        return {
          externalId: result.result?.task_id ? String(result.result.task_id) : '0',
          marketplaceData: {
            task_id: result.result?.task_id,
            offer_id: ozonProduct.offer_id,
          },
        };
      }

      case 'yandex_market': {
        const ymClient = client as YandexMarketClient;
        const yandexOffer = product as YandexOffer;
        await ymClient.updateOfferMappings([{ offer: yandexOffer }]);
        // YM uses offerId as the identifier
        return {
          externalId: yandexOffer.offerId,
          marketplaceData: { offerId: yandexOffer.offerId },
        };
      }

      default:
        throw new Error(`Unknown marketplace: ${marketplace}`);
    }
  }

  private async updateProduct(
    client: WildberriesClient | OzonClient | YandexMarketClient,
    marketplace: MarketplaceType,
    product: MarketplaceProduct,
    externalId: string,
  ): Promise<void> {
    switch (marketplace) {
      case 'wildberries': {
        // WB updates are done through the same cards endpoint
        // This is a simplified version
        this.logger.debug(`Updating WB product ${externalId}`);
        break;
      }

      case 'ozon': {
        const ozonClient = client as OzonClient;
        const ozonProduct = product as OzonProduct;
        // Convert OzonProduct to import format (attribute_id -> id)
        const importItem = {
          offer_id: ozonProduct.offer_id,
          name: ozonProduct.name,
          barcode: ozonProduct.barcode,
          price: ozonProduct.price,
          images: ozonProduct.images,
          attributes: ozonProduct.attributes?.map((attr) => ({
            id: attr.attribute_id,
            complex_id: attr.complex_id,
            values: attr.values || [],
          })),
        };
        await ozonClient.importProducts([importItem]);
        break;
      }

      case 'yandex_market': {
        const ymClient = client as YandexMarketClient;
        const yandexOffer = product as YandexOffer;
        await ymClient.updateOfferMappings([{ offer: yandexOffer }]);
        break;
      }

      default:
        throw new Error(`Unknown marketplace: ${marketplace}`);
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
