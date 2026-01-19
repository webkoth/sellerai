import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { QUEUE_NAMES } from '@hubmarket/queues';
import { YandexMarketClient } from '@hubmarket/marketplace-clients';
import { MarketplaceJobService } from './marketplace-job.service';
import { YandexTransformer } from '../shared/transformers/yandex.transformer';

interface YandexJobData {
  type: 'update-stock' | 'update-price';
  canonicalProductId: string;
  marketplaceAccountId: string;
  newStock?: number;
  newPrice?: number;
  warehouseId?: string;
}

/**
 * Yandex Market Job Processor
 *
 * Rate limits:
 * - All APIs: 300 req/60s, max 2 concurrent
 *
 * Concurrency is set to 2 to match API limits
 */
@Processor(QUEUE_NAMES.MP_YANDEX, {
  concurrency: 2, // Match API max concurrent limit
  limiter: {
    max: 250, // 250 jobs per minute (leaving headroom from 300)
    duration: 60000,
  },
})
export class YandexJobProcessor extends WorkerHost {
  private readonly logger = new Logger(YandexJobProcessor.name);

  constructor(
    private readonly jobService: MarketplaceJobService,
    private readonly transformer: YandexTransformer,
  ) {
    super();
  }

  async process(job: Job<YandexJobData>): Promise<void> {
    const {
      type,
      canonicalProductId,
      marketplaceAccountId,
      newStock,
      newPrice,
      warehouseId,
    } = job.data;

    this.logger.debug(`Processing Yandex job: type=${type}, product=${canonicalProductId}`);

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
          `No mapping for product ${canonicalProductId} on Yandex account ${marketplaceAccountId}`,
        );
        return;
      }

      if (!mapping.externalId || !mapping.externalSku) {
        this.logger.warn(
          `Missing externalId or externalSku for product ${canonicalProductId} on Yandex`,
        );
        return;
      }

      const client = new YandexMarketClient({
        oauthToken: account.credentials.oauthToken as string,
        businessId: Number(account.credentials.businessId),
        campaignId: Number(account.credentials.campaignId),
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
        `Yandex job completed: type=${type}, product=${canonicalProductId}`,
      );
    } catch (error) {
      this.logger.error(`Yandex job failed: type=${type}, product=${canonicalProductId}`, error);

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
    client: YandexMarketClient,
    mapping: { externalId: string; externalSku: string; canonicalProduct?: { internalSku: string } },
    newStock: number,
    warehouseId?: string,
  ): Promise<void> {
    const offerId = mapping.externalSku;
    const wId = warehouseId ? parseInt(warehouseId, 10) : 0;

    await client.updateStocks([
      {
        sku: offerId,
        warehouseId: wId,
        items: [
          {
            count: newStock,
            type: 'FIT',
            updatedAt: new Date().toISOString(),
          },
        ],
      },
    ]);

    this.logger.debug(
      `Updated Yandex stock: offerId=${offerId}, stock=${newStock}, warehouse=${warehouseId}`,
    );
  }

  private async updatePrice(
    client: YandexMarketClient,
    mapping: { externalId: string; externalSku: string; canonicalProduct?: { internalSku: string; currency?: string | null } },
    newPrice: number,
  ): Promise<void> {
    const offerId = mapping.externalSku;

    await client.updatePrices([
      {
        offerId,
        price: {
          value: newPrice,
          currencyId: mapping.canonicalProduct?.currency || 'RUB',
        },
      },
    ]);

    this.logger.debug(`Updated Yandex price: offerId=${offerId}, price=${newPrice}`);
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job<YandexJobData>) {
    this.logger.debug(`Yandex job completed: ${job.id}`);
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job<YandexJobData>, error: Error) {
    this.logger.error(`Yandex job failed: ${job.id}, error=${error.message}`);
  }
}
