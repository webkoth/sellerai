import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { QUEUE_NAMES } from '@hubmarket/queues';
import { OzonClient } from '@hubmarket/marketplace-clients';
import { MarketplaceJobService } from './marketplace-job.service';
import { OzonTransformer } from '../shared/transformers/ozon.transformer';

interface OzonJobData {
  type: 'update-stock' | 'update-price';
  canonicalProductId: string;
  marketplaceAccountId: string;
  newStock?: number;
  newPrice?: number;
  warehouseId?: string;
  stockType?: 'fbo' | 'fbs';
}

/**
 * Ozon Job Processor
 *
 * Rate limits:
 * - All APIs: 300 req/60s
 *
 * Supports both FBO and FBS stock updates
 */
@Processor(QUEUE_NAMES.MP_OZON, {
  concurrency: 2,
  limiter: {
    max: 250, // 250 jobs per minute (leaving headroom from 300)
    duration: 60000,
  },
})
export class OzonJobProcessor extends WorkerHost {
  private readonly logger = new Logger(OzonJobProcessor.name);

  constructor(
    private readonly jobService: MarketplaceJobService,
    private readonly transformer: OzonTransformer,
  ) {
    super();
  }

  async process(job: Job<OzonJobData>): Promise<void> {
    const {
      type,
      canonicalProductId,
      marketplaceAccountId,
      newStock,
      newPrice,
      warehouseId,
      stockType = 'fbo',
    } = job.data;

    this.logger.debug(`Processing Ozon job: type=${type}, product=${canonicalProductId}`);

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
          `No mapping for product ${canonicalProductId} on Ozon account ${marketplaceAccountId}`,
        );
        return;
      }

      if (!mapping.externalId || !mapping.externalSku) {
        this.logger.warn(
          `Missing externalId or externalSku for product ${canonicalProductId} on Ozon`,
        );
        return;
      }

      const client = new OzonClient({
        clientId: account.credentials.clientId as string,
        apiKey: account.credentials.apiKey as string,
      });

      const validMapping = {
        ...mapping,
        externalId: mapping.externalId,
        externalSku: mapping.externalSku,
      };

      switch (type) {
        case 'update-stock':
          await this.updateStock(client, validMapping, newStock!, warehouseId, stockType);
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
        `Ozon job completed: type=${type}, product=${canonicalProductId}`,
      );
    } catch (error) {
      this.logger.error(`Ozon job failed: type=${type}, product=${canonicalProductId}`, error);

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
    client: OzonClient,
    mapping: { externalId: string; externalSku: string; marketplaceData?: Record<string, unknown> },
    newStock: number,
    warehouseId?: string,
    stockType: 'fbo' | 'fbs' = 'fbo',
  ): Promise<void> {
    const productId = parseInt(mapping.externalId, 10);
    const offerId = mapping.externalSku;

    if (stockType === 'fbs' && warehouseId) {
      // FBS update with warehouse ID
      await client.updateStocksFBS([
        {
          offer_id: offerId,
          product_id: productId || undefined,
          stock: newStock,
          warehouse_id: parseInt(warehouseId, 10),
        },
      ]);
    } else {
      // FBO update (no warehouse ID needed)
      await client.updateStocksFBO([
        {
          offer_id: offerId,
          product_id: productId || undefined,
          stock: newStock,
        },
      ]);
    }

    this.logger.debug(
      `Updated Ozon stock: offerId=${offerId}, stock=${newStock}, type=${stockType}`,
    );
  }

  private async updatePrice(
    client: OzonClient,
    mapping: { externalId: string; externalSku: string; canonicalProduct?: { basePrice?: number | null; minPrice?: number | null } },
    newPrice: number,
  ): Promise<void> {
    const productId = parseInt(mapping.externalId, 10);
    const offerId = mapping.externalSku;

    await client.updatePrices([
      {
        offer_id: offerId,
        product_id: productId || undefined,
        price: String(newPrice),
        old_price: String(Math.round(newPrice * 1.1)), // 10% markup for strikethrough
        min_price: mapping.canonicalProduct?.minPrice
          ? String(mapping.canonicalProduct.minPrice)
          : undefined,
      },
    ]);

    this.logger.debug(`Updated Ozon price: offerId=${offerId}, price=${newPrice}`);
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job<OzonJobData>) {
    this.logger.debug(`Ozon job completed: ${job.id}`);
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job<OzonJobData>, error: Error) {
    this.logger.error(`Ozon job failed: ${job.id}, error=${error.message}`);
  }
}
