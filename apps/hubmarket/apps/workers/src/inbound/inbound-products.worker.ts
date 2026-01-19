import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { QUEUE_NAMES } from '@hubmarket/queues';
import { MarketplaceType, ProductSize } from '@hubmarket/core';
import { InboundSyncService, InboundSyncJobData } from './inbound-sync.service';
import { TransformerFactory } from '../shared/transformers/transformer.factory';
import { WildberriesTransformer } from '../shared/transformers/wildberries.transformer';
import {
  WildberriesClient,
  OzonClient,
  YandexMarketClient,
  WBProduct,
  OzonProduct,
  YandexOffer,
} from '@hubmarket/marketplace-clients';

type MarketplaceProduct = WBProduct | OzonProduct | YandexOffer;

@Processor(QUEUE_NAMES.SYNC_INBOUND_PRODUCTS, {
  concurrency: 2,
})
export class InboundProductsWorker extends WorkerHost {
  private readonly logger = new Logger(InboundProductsWorker.name);

  constructor(
    private readonly inboundSyncService: InboundSyncService,
    private readonly transformerFactory: TransformerFactory,
  ) {
    super();
  }

  async process(job: Job<InboundSyncJobData>): Promise<void> {
    const { syncJobId, marketplaceAccountId, organizationId, marketplace } = job.data;

    this.logger.log(`Starting inbound products sync for ${marketplace}, job: ${syncJobId}`);

    try {
      await this.inboundSyncService.updateSyncJobProgress(syncJobId, {
        status: 'processing',
      });

      const account = await this.inboundSyncService.getAccountWithCredentials(marketplaceAccountId);
      if (!account) {
        throw new Error(`Account not found: ${marketplaceAccountId}`);
      }

      const client = this.createClient(marketplace, account.credentials);
      const transformer = this.transformerFactory.getTransformer(marketplace);

      let cursor: string | undefined;
      let totalProcessed = 0;
      let successCount = 0;
      let failedCount = 0;
      const errors: Array<{ sku: string; error: string }> = [];

      do {
        const { products, nextCursor } = await this.fetchProducts(
          client,
          marketplace,
          cursor,
        );

        await job.updateProgress({
          processed: totalProcessed,
          current: products.length,
        });

        for (const mpProduct of products) {
          try {
            const canonicalData = transformer.toCanonical(mpProduct as never);
            const internalSku = this.extractSku(mpProduct, marketplace);

            const canonical = await this.inboundSyncService.upsertCanonicalProduct(
              organizationId,
              internalSku,
              canonicalData,
            );

            // Sync barcodes for products with sizes
            const sizes = this.extractSizes(mpProduct, marketplace);
            if (sizes.length > 0) {
              await this.inboundSyncService.syncProductBarcodes(
                canonical.id,
                sizes,
              );
            }

            const { externalId, externalSku, marketplaceData } =
              this.extractMappingData(mpProduct, marketplace);

            await this.inboundSyncService.upsertMapping(
              canonical.id,
              marketplaceAccountId,
              externalId,
              externalSku,
              marketplaceData,
            );

            successCount++;
          } catch (error) {
            failedCount++;
            const sku = this.extractSku(mpProduct, marketplace);
            errors.push({
              sku,
              error: error instanceof Error ? error.message : String(error),
            });
            this.logger.error(`Failed to process product ${sku}:`, error);
          }
          totalProcessed++;
        }

        await this.inboundSyncService.updateSyncJobProgress(syncJobId, {
          processedItems: totalProcessed,
          successItems: successCount,
          failedItems: failedCount,
        });

        cursor = nextCursor;
      } while (cursor);

      await this.inboundSyncService.updateSyncJobProgress(syncJobId, {
        status: failedCount > 0 && successCount === 0 ? 'failed' : 'completed',
        processedItems: totalProcessed,
        successItems: successCount,
        failedItems: failedCount,
        errors: errors.length > 0 ? errors.slice(0, 100) : undefined,
      });

      this.logger.log(
        `Completed inbound products sync: ${successCount} success, ${failedCount} failed`,
      );
    } catch (error) {
      this.logger.error(`Inbound products sync failed:`, error);

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

  private async fetchProducts(
    client: WildberriesClient | OzonClient | YandexMarketClient,
    marketplace: MarketplaceType,
    cursor?: string,
  ): Promise<{ products: MarketplaceProduct[]; nextCursor?: string }> {
    const limit = 100;

    switch (marketplace) {
      case 'wildberries': {
        const wbClient = client as WildberriesClient;
        const response = await wbClient.getProductsList({
          limit,
          nmID: cursor ? parseInt(cursor, 10) : undefined,
        });
        const products = response.cards || [];
        const lastProduct = products[products.length - 1];
        return {
          products,
          nextCursor: products.length === limit && lastProduct
            ? String(lastProduct.nmID)
            : undefined,
        };
      }

      case 'ozon': {
        const ozonClient = client as OzonClient;
        const response = await ozonClient.getProductsList({
          limit,
          last_id: cursor,
        });
        return {
          products: response.result?.items || [],
          nextCursor: response.result?.last_id || undefined,
        };
      }

      case 'yandex_market': {
        const ymClient = client as YandexMarketClient;
        const response = await ymClient.getOfferMappings({
          limit,
          page_token: cursor,
        });
        return {
          products: response.result?.offerMappings?.map((m: { offer: YandexOffer }) => m.offer) || [],
          nextCursor: response.result?.paging?.nextPageToken,
        };
      }

      default:
        throw new Error(`Unknown marketplace: ${marketplace}`);
    }
  }

  private extractSku(product: MarketplaceProduct, marketplace: MarketplaceType): string {
    switch (marketplace) {
      case 'wildberries':
        return (product as WBProduct).vendorCode;
      case 'ozon':
        return (product as OzonProduct).offer_id;
      case 'yandex_market':
        return (product as YandexOffer).offerId;
      default:
        throw new Error(`Unknown marketplace: ${marketplace}`);
    }
  }

  private extractMappingData(
    product: MarketplaceProduct,
    marketplace: MarketplaceType,
  ): { externalId: string; externalSku: string; marketplaceData: Record<string, unknown> } {
    switch (marketplace) {
      case 'wildberries': {
        const wbProduct = product as WBProduct;
        return {
          externalId: String(wbProduct.nmID),
          externalSku: wbProduct.vendorCode,
          marketplaceData: {
            nmId: wbProduct.nmID,
            imtId: wbProduct.imtID,
            vendorCode: wbProduct.vendorCode,
          },
        };
      }

      case 'ozon': {
        const ozonProduct = product as OzonProduct;
        return {
          externalId: String(ozonProduct.id),
          externalSku: ozonProduct.offer_id,
          marketplaceData: {
            product_id: ozonProduct.id,
            offer_id: ozonProduct.offer_id,
            is_fbo_visible: ozonProduct.is_fbo_visible,
            is_fbs_visible: ozonProduct.is_fbs_visible,
          },
        };
      }

      case 'yandex_market': {
        const ymOffer = product as YandexOffer;
        return {
          externalId: ymOffer.offerId,
          externalSku: ymOffer.offerId,
          marketplaceData: {
            offerId: ymOffer.offerId,
          },
        };
      }

      default:
        throw new Error(`Unknown marketplace: ${marketplace}`);
    }
  }

  private extractSizes(
    product: MarketplaceProduct,
    marketplace: MarketplaceType,
  ): ProductSize[] {
    switch (marketplace) {
      case 'wildberries': {
        const wbProduct = product as WBProduct;
        const sizes: ProductSize[] = [];

        for (const size of wbProduct.sizes || []) {
          for (const sku of size.skus || []) {
            sizes.push({
              sizeCode: size.techSize || '',
              techSize: size.techSize || '',
              barcode: sku,
              wmsId: size.wmsId,
              price: size.price ? size.price / 100 : undefined,
            });
          }
        }

        return sizes;
      }

      case 'ozon': {
        const ozonProduct = product as OzonProduct;
        // Ozon products don't have size/barcode structure like WB
        // Barcode is typically in the product itself
        if (ozonProduct.barcode) {
          return [{
            sizeCode: '',
            techSize: '',
            barcode: ozonProduct.barcode,
          }];
        }
        return [];
      }

      case 'yandex_market': {
        const ymOffer = product as YandexOffer;
        // Yandex offers have barcodes array
        const barcodes = ymOffer.barcodes || [];
        return barcodes.map((barcode: string) => ({
          sizeCode: '',
          techSize: '',
          barcode,
        }));
      }

      default:
        return [];
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
