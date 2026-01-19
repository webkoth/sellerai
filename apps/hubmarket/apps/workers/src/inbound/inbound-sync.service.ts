import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import {
  CanonicalProduct,
  ProductMarketplaceMapping,
  ProductBarcode,
  MarketplaceAccount,
  SyncJob,
  MarketplaceType,
  SyncJobStatus,
  SyncJobType,
  SyncDirection,
  ProductSize,
} from '@hubmarket/core';
import { QUEUE_NAMES } from '@hubmarket/queues';

export interface InboundSyncJobData {
  syncJobId: string;
  marketplaceAccountId: string;
  organizationId: string;
  marketplace: MarketplaceType;
  cursor?: string;
  batchSize?: number;
}

@Injectable()
export class InboundSyncService {
  private readonly logger = new Logger(InboundSyncService.name);

  constructor(
    @InjectRepository(CanonicalProduct)
    private readonly productRepo: Repository<CanonicalProduct>,
    @InjectRepository(ProductMarketplaceMapping)
    private readonly mappingRepo: Repository<ProductMarketplaceMapping>,
    @InjectRepository(ProductBarcode)
    private readonly barcodeRepo: Repository<ProductBarcode>,
    @InjectRepository(MarketplaceAccount)
    private readonly accountRepo: Repository<MarketplaceAccount>,
    @InjectRepository(SyncJob)
    private readonly syncJobRepo: Repository<SyncJob>,
    @InjectQueue(QUEUE_NAMES.SYNC_INBOUND_PRODUCTS)
    private readonly productsQueue: Queue,
    @InjectQueue(QUEUE_NAMES.SYNC_INBOUND_PRICES)
    private readonly pricesQueue: Queue,
  ) {}

  /**
   * Start inbound products sync from master marketplace
   */
  async startProductsSync(organizationId: string): Promise<SyncJob> {
    const masterAccount = await this.findMasterAccount(organizationId);
    if (!masterAccount) {
      throw new Error('No master marketplace account configured');
    }

    const syncJob = await this.createSyncJob(
      organizationId,
      masterAccount.id,
      'products',
      'inbound',
    );

    await this.productsQueue.add(
      'sync-products',
      {
        syncJobId: syncJob.id,
        marketplaceAccountId: masterAccount.id,
        organizationId,
        marketplace: masterAccount.marketplace,
      } as InboundSyncJobData,
      {
        jobId: `inbound-products-${syncJob.id}`,
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
      },
    );

    return syncJob;
  }

  /**
   * Start inbound prices sync from master marketplace
   */
  async startPricesSync(organizationId: string): Promise<SyncJob> {
    const masterAccount = await this.findMasterAccount(organizationId);
    if (!masterAccount) {
      throw new Error('No master marketplace account configured');
    }

    const syncJob = await this.createSyncJob(
      organizationId,
      masterAccount.id,
      'prices',
      'inbound',
    );

    await this.pricesQueue.add(
      'sync-prices',
      {
        syncJobId: syncJob.id,
        marketplaceAccountId: masterAccount.id,
        organizationId,
        marketplace: masterAccount.marketplace,
      } as InboundSyncJobData,
      {
        jobId: `inbound-prices-${syncJob.id}`,
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
      },
    );

    return syncJob;
  }

  /**
   * Find or create canonical product from marketplace data
   */
  async upsertCanonicalProduct(
    organizationId: string,
    internalSku: string,
    data: Partial<CanonicalProduct>,
  ): Promise<CanonicalProduct> {
    let product = await this.productRepo.findOne({
      where: { organizationId, internalSku },
    });

    if (product) {
      Object.assign(product, data, { updatedAt: new Date() });
    } else {
      product = this.productRepo.create({
        ...data,
        organizationId,
        internalSku,
        status: 'active',
      });
    }

    return this.productRepo.save(product);
  }

  /**
   * Create or update marketplace mapping
   */
  async upsertMapping(
    canonicalProductId: string,
    marketplaceAccountId: string,
    externalId: string,
    externalSku: string,
    marketplaceData: Record<string, unknown>,
  ): Promise<ProductMarketplaceMapping> {
    let mapping = await this.mappingRepo.findOne({
      where: { canonicalProductId, marketplaceAccountId },
    });

    if (mapping) {
      mapping.externalId = externalId;
      mapping.externalSku = externalSku;
      mapping.marketplaceData = marketplaceData;
      mapping.lastSyncAt = new Date();
      mapping.syncStatus = 'synced';
    } else {
      mapping = this.mappingRepo.create({
        canonicalProductId,
        marketplaceAccountId,
        externalId,
        externalSku,
        marketplaceData,
        syncStatus: 'synced',
        lastSyncAt: new Date(),
      });
    }

    return this.mappingRepo.save(mapping);
  }

  /**
   * Sync product barcodes from marketplace sizes data
   */
  async syncProductBarcodes(
    canonicalProductId: string,
    sizes: ProductSize[],
  ): Promise<void> {
    // Get existing barcodes
    const existingBarcodes = await this.barcodeRepo.find({
      where: { canonicalProductId },
    });
    const existingSet = new Set(existingBarcodes.map((b) => b.barcode));

    // Add new barcodes
    for (const size of sizes) {
      if (size.barcode && !existingSet.has(size.barcode)) {
        try {
          const barcodeEntity = this.barcodeRepo.create({
            canonicalProductId,
            barcode: size.barcode,
            sizeCode: size.sizeCode || null,
            techSize: size.techSize || null,
            wmsId: size.wmsId || null,
          });
          await this.barcodeRepo.save(barcodeEntity);
        } catch (error) {
          // Ignore duplicate barcode errors (unique constraint)
          if (!String(error).includes('duplicate')) {
            throw error;
          }
        }
      }
    }
  }

  /**
   * Update sync job progress
   */
  async updateSyncJobProgress(
    syncJobId: string,
    updates: Partial<Pick<SyncJob, 'processedItems' | 'successItems' | 'failedItems' | 'status' | 'errors'>>,
  ): Promise<void> {
    await this.syncJobRepo.update(syncJobId, {
      ...updates,
      ...(updates.status === 'completed' || updates.status === 'failed'
        ? { completedAt: new Date() }
        : {}),
    });
  }

  /**
   * Get marketplace account with credentials
   */
  async getAccountWithCredentials(accountId: string): Promise<MarketplaceAccount | null> {
    return this.accountRepo.findOne({ where: { id: accountId } });
  }

  private async findMasterAccount(organizationId: string): Promise<MarketplaceAccount | null> {
    return this.accountRepo.findOne({
      where: { organizationId, isMaster: true, isActive: true },
    });
  }

  private async createSyncJob(
    organizationId: string,
    marketplaceAccountId: string,
    jobType: SyncJobType,
    direction: SyncDirection,
  ): Promise<SyncJob> {
    const syncJob = this.syncJobRepo.create({
      organizationId,
      marketplaceAccountId,
      jobType,
      direction,
      status: 'pending' as SyncJobStatus,
      totalItems: 0,
      processedItems: 0,
      successItems: 0,
      failedItems: 0,
      startedAt: new Date(),
    });

    return this.syncJobRepo.save(syncJob);
  }
}
