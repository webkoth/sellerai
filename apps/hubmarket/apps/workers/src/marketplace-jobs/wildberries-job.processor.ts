import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { QUEUE_NAMES } from '@hubmarket/queues';
import { WildberriesClient } from '@hubmarket/marketplace-clients';
import { MarketplaceJobService } from './marketplace-job.service';
import { WildberriesTransformer } from '../shared/transformers/wildberries.transformer';

interface WBJobData {
  type: 'update-stock' | 'update-price';
  canonicalProductId: string;
  marketplaceAccountId: string;
  newStock?: number;
  newPrice?: number;
  warehouseId?: string;
}

/**
 * Wildberries Job Processor
 *
 * Rate limits:
 * - Content API: 60 req/60s
 * - Marketplace API: 300 req/60s (stocks endpoint)
 *
 * Concurrency is set low to respect rate limits
 */
@Processor(QUEUE_NAMES.MP_WILDBERRIES_STOCKS, {
  concurrency: 1, // Low concurrency due to rate limits
  limiter: {
    max: 50, // 50 jobs per minute (leaving headroom)
    duration: 60000,
  },
})
export class WildberriesJobProcessor extends WorkerHost {
  private readonly logger = new Logger(WildberriesJobProcessor.name);

  constructor(
    private readonly jobService: MarketplaceJobService,
    private readonly transformer: WildberriesTransformer,
  ) {
    super();
  }

  async process(job: Job<WBJobData>): Promise<void> {
    const { type, canonicalProductId, marketplaceAccountId, newStock, newPrice, warehouseId } = job.data;

    this.logger.debug(`Processing WB job: type=${type}, product=${canonicalProductId}`);

    try {
      const account = await this.jobService.getAccountWithCredentials(marketplaceAccountId);
      if (!account) {
        throw new Error(`Account not found: ${marketplaceAccountId}`);
      }

      const mapping = await this.jobService.getMappingWithProduct(
        canonicalProductId,
        marketplaceAccountId,
      );

      if (!mapping) {
        this.logger.warn(
          `No mapping for product ${canonicalProductId} on WB account ${marketplaceAccountId}`,
        );
        return;
      }

      if (!mapping.externalId || !mapping.externalSku) {
        this.logger.warn(
          `Missing externalId or externalSku for product ${canonicalProductId} on WB`,
        );
        return;
      }

      const client = new WildberriesClient({
        apiKey: account.credentials.apiKey as string,
      });

      const validMapping = {
        ...mapping,
        externalId: mapping.externalId,
        externalSku: mapping.externalSku,
      };

      switch (type) {
        case 'update-stock':
          await this.updateStock(client, validMapping, newStock!, warehouseId);
          await this.jobService.updateMappingStock(mapping.id, newStock!);
          break;

        case 'update-price':
          await this.updatePrice(client, validMapping, newPrice!);
          await this.jobService.updateMappingPrice(mapping.id, newPrice!);
          break;

        default:
          throw new Error(`Unknown job type: ${type}`);
      }

      this.logger.debug(
        `WB job completed: type=${type}, product=${canonicalProductId}`,
      );
    } catch (error) {
      this.logger.error(`WB job failed: type=${type}, product=${canonicalProductId}`, error);

      // Update mapping with error status
      try {
        const mapping = await this.jobService.getMappingWithProduct(
          canonicalProductId,
          marketplaceAccountId,
        );
        if (mapping) {
          await this.jobService.updateMappingStock(
            mapping.id,
            newStock ?? mapping.currentStock ?? 0,
            'error',
            error instanceof Error ? error.message : String(error),
          );
        }
      } catch {
        // Ignore secondary errors
      }

      throw error;
    }
  }

  private async updateStock(
    client: WildberriesClient,
    mapping: { externalId: string; externalSku: string; canonicalProduct?: { barcode?: string | null; internalSku: string } },
    newStock: number,
    warehouseId?: string,
  ): Promise<void> {
    // WB uses barcode or vendorCode (SKU) for stock updates
    const sku = mapping.canonicalProduct?.barcode || mapping.externalSku;
    const wId = warehouseId ? parseInt(warehouseId, 10) : 0;

    await client.updateStocks(wId, [
      {
        sku,
        amount: newStock,
      },
    ]);

    this.logger.debug(`Updated WB stock: sku=${sku}, stock=${newStock}, warehouse=${wId}`);
  }

  private async updatePrice(
    client: WildberriesClient,
    mapping: { externalId: string; canonicalProduct?: { basePrice?: number | null } },
    newPrice: number,
  ): Promise<void> {
    const nmID = parseInt(mapping.externalId, 10);

    await client.updatePrices([
      {
        nmID,
        price: Math.round(newPrice * 100), // WB uses kopecks
        discount: 0,
      },
    ]);

    this.logger.debug(`Updated WB price: nmID=${nmID}, price=${newPrice}`);
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job<WBJobData>) {
    this.logger.debug(`WB job completed: ${job.id}`);
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job<WBJobData>, error: Error) {
    this.logger.error(`WB job failed: ${job.id}, error=${error.message}`);
  }
}
