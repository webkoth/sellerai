import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Not } from 'typeorm';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import {
  CanonicalProduct,
  ProductMarketplaceMapping,
  MarketplaceAccount,
  SyncJob,
  MarketplaceType,
  SyncJobStatus,
  SyncJobType,
  SyncDirection,
} from '@hubmarket/core';
import { QUEUE_NAMES } from '@hubmarket/queues';

export interface OutboundSyncJobData {
  syncJobId: string;
  marketplaceAccountId: string;
  organizationId: string;
  marketplace: MarketplaceType;
  productIds?: string[];
}

@Injectable()
export class OutboundSyncService {
  private readonly logger = new Logger(OutboundSyncService.name);

  constructor(
    @InjectRepository(CanonicalProduct)
    private readonly productRepo: Repository<CanonicalProduct>,
    @InjectRepository(ProductMarketplaceMapping)
    private readonly mappingRepo: Repository<ProductMarketplaceMapping>,
    @InjectRepository(MarketplaceAccount)
    private readonly accountRepo: Repository<MarketplaceAccount>,
    @InjectRepository(SyncJob)
    private readonly syncJobRepo: Repository<SyncJob>,
    @InjectQueue(QUEUE_NAMES.SYNC_OUTBOUND_PRODUCTS)
    private readonly productsQueue: Queue,
    @InjectQueue(QUEUE_NAMES.SYNC_OUTBOUND_PRICES)
    private readonly pricesQueue: Queue,
  ) {}

  /**
   * Start outbound prices sync to all slave marketplaces
   */
  async startPricesSync(
    organizationId: string,
    productIds?: string[],
  ): Promise<SyncJob[]> {
    const slaveAccounts = await this.findSlaveAccounts(organizationId);
    if (slaveAccounts.length === 0) {
      this.logger.warn('No slave marketplace accounts configured');
      return [];
    }

    const syncJobs: SyncJob[] = [];

    for (const account of slaveAccounts) {
      const syncJob = await this.createSyncJob(
        organizationId,
        account.id,
        'prices',
        'outbound',
      );

      await this.pricesQueue.add(
        'sync-prices',
        {
          syncJobId: syncJob.id,
          marketplaceAccountId: account.id,
          organizationId,
          marketplace: account.marketplace,
          productIds,
        } as OutboundSyncJobData,
        {
          jobId: `outbound-prices-${syncJob.id}`,
          attempts: 3,
          backoff: { type: 'exponential', delay: 5000 },
        },
      );

      syncJobs.push(syncJob);
    }

    return syncJobs;
  }

  /**
   * Start outbound products sync to all slave marketplaces
   */
  async startProductsSync(
    organizationId: string,
    productIds?: string[],
  ): Promise<SyncJob[]> {
    const slaveAccounts = await this.findSlaveAccounts(organizationId);
    if (slaveAccounts.length === 0) {
      this.logger.warn('No slave marketplace accounts configured');
      return [];
    }

    const syncJobs: SyncJob[] = [];

    for (const account of slaveAccounts) {
      const syncJob = await this.createSyncJob(
        organizationId,
        account.id,
        'products',
        'outbound',
      );

      await this.productsQueue.add(
        'sync-products',
        {
          syncJobId: syncJob.id,
          marketplaceAccountId: account.id,
          organizationId,
          marketplace: account.marketplace,
          productIds,
        } as OutboundSyncJobData,
        {
          jobId: `outbound-products-${syncJob.id}`,
          attempts: 3,
          backoff: { type: 'exponential', delay: 5000 },
        },
      );

      syncJobs.push(syncJob);
    }

    return syncJobs;
  }

  /**
   * Get products to sync with their mappings
   */
  async getProductsToSync(
    organizationId: string,
    marketplaceAccountId: string,
    productIds?: string[],
  ): Promise<Array<{ product: CanonicalProduct; mapping?: ProductMarketplaceMapping }>> {
    const queryBuilder = this.productRepo
      .createQueryBuilder('product')
      .leftJoinAndSelect(
        'product.mappings',
        'mapping',
        'mapping.marketplaceAccountId = :marketplaceAccountId',
        { marketplaceAccountId },
      )
      .where('product.organizationId = :organizationId', { organizationId })
      .andWhere('product.status = :status', { status: 'active' });

    if (productIds && productIds.length > 0) {
      queryBuilder.andWhere('product.id IN (:...productIds)', { productIds });
    }

    const products = await queryBuilder.getMany();

    return products.map((product) => ({
      product,
      mapping: product.mappings?.[0],
    }));
  }

  /**
   * Update mapping after successful sync
   */
  async updateMappingAfterSync(
    mappingId: string,
    updates: Partial<Pick<ProductMarketplaceMapping, 'currentPrice' | 'currentStock' | 'syncStatus' | 'lastError'>>,
  ): Promise<void> {
    await this.mappingRepo.update(mappingId, {
      ...updates,
      lastSyncAt: new Date(),
    });
  }

  /**
   * Create or update mapping
   */
  async upsertMapping(
    canonicalProductId: string,
    marketplaceAccountId: string,
    data: Partial<ProductMarketplaceMapping>,
  ): Promise<ProductMarketplaceMapping> {
    let mapping = await this.mappingRepo.findOne({
      where: { canonicalProductId, marketplaceAccountId },
    });

    if (mapping) {
      Object.assign(mapping, data, { lastSyncAt: new Date() });
    } else {
      mapping = this.mappingRepo.create({
        ...data,
        canonicalProductId,
        marketplaceAccountId,
        lastSyncAt: new Date(),
      });
    }

    return this.mappingRepo.save(mapping);
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

  private async findSlaveAccounts(organizationId: string): Promise<MarketplaceAccount[]> {
    return this.accountRepo.find({
      where: {
        organizationId,
        isMaster: false,
        isActive: true,
      },
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

    return this.syncJobRepo.save(syncJob) as Promise<SyncJob>;
  }
}
