import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { QUEUE_NAMES } from '@hubmarket/queues';
import { SyncJob } from '@hubmarket/core';
import { AccountsService } from '../accounts/accounts.service';
import { SyncService } from './sync.service';
import {
  StartSyncDto,
  SyncType,
  SyncDirection,
  SyncProductsDto,
  SyncPricesDto,
  SyncStocksDto,
  QueueStatusDto,
  SyncStatusResponseDto,
} from './dto/sync.dto';

@Injectable()
export class SyncOrchestrator {
  private readonly logger = new Logger(SyncOrchestrator.name);

  private readonly queues: Map<string, Queue>;

  constructor(
    @InjectQueue(QUEUE_NAMES.SYNC_INBOUND_PRODUCTS)
    private readonly inboundProductsQueue: Queue,
    @InjectQueue(QUEUE_NAMES.SYNC_INBOUND_PRICES)
    private readonly inboundPricesQueue: Queue,
    @InjectQueue(QUEUE_NAMES.SYNC_OUTBOUND_PRODUCTS)
    private readonly outboundProductsQueue: Queue,
    @InjectQueue(QUEUE_NAMES.SYNC_OUTBOUND_PRICES)
    private readonly outboundPricesQueue: Queue,
    @InjectQueue(QUEUE_NAMES.ORDERS_STOCK_UPDATE)
    private readonly stockUpdateQueue: Queue,
    @InjectQueue(QUEUE_NAMES.ORDER_POLL)
    private readonly orderPollQueue: Queue,
    private readonly accountsService: AccountsService,
    private readonly syncService: SyncService,
  ) {
    this.queues = new Map([
      [QUEUE_NAMES.SYNC_INBOUND_PRODUCTS, inboundProductsQueue],
      [QUEUE_NAMES.SYNC_INBOUND_PRICES, inboundPricesQueue],
      [QUEUE_NAMES.SYNC_OUTBOUND_PRODUCTS, outboundProductsQueue],
      [QUEUE_NAMES.SYNC_OUTBOUND_PRICES, outboundPricesQueue],
      [QUEUE_NAMES.ORDERS_STOCK_UPDATE, stockUpdateQueue],
      [QUEUE_NAMES.ORDER_POLL, orderPollQueue],
    ]);
  }

  /**
   * Start sync based on DTO configuration
   */
  async startSync(dto: StartSyncDto): Promise<SyncJob[]> {
    const { organizationId, type, direction, productIds, force } = dto;

    this.logger.log(
      `Starting ${type} sync (${direction}) for org ${organizationId}`,
    );

    const jobs: SyncJob[] = [];

    switch (type) {
      case SyncType.FULL:
        jobs.push(...(await this.startFullSync(organizationId)));
        break;

      case SyncType.PRODUCTS:
        jobs.push(
          await this.syncProducts({
            organizationId,
            productIds,
            includeOutbound: direction !== SyncDirection.INBOUND,
          }),
        );
        break;

      case SyncType.PRICES:
        jobs.push(await this.syncPrices({ organizationId, productIds }));
        break;

      case SyncType.STOCKS:
        jobs.push(await this.syncStocks({ organizationId, productIds }));
        break;
    }

    return jobs;
  }

  /**
   * Full sync: products + prices from master, then propagate to slaves
   */
  async startFullSync(organizationId: string): Promise<SyncJob[]> {
    this.logger.log(`Starting full sync for organization ${organizationId}`);

    const masterAccount = await this.accountsService.findMaster(organizationId);
    if (!masterAccount) {
      throw new BadRequestException('Master marketplace not configured');
    }

    const jobs: SyncJob[] = [];

    // 1. Inbound products sync from master
    const productsJob = await this.syncService.createJob({
      organizationId,
      marketplaceAccountId: masterAccount.id,
      jobType: 'products',
      direction: 'inbound',
    });

    await this.inboundProductsQueue.add(
      'sync-products',
      {
        syncJobId: productsJob.id,
        organizationId,
        marketplaceAccountId: masterAccount.id,
        marketplace: masterAccount.marketplace,
      },
      {
        jobId: `inbound-products-${productsJob.id}`,
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
      },
    );
    jobs.push(productsJob);

    // 2. Inbound prices sync from master
    const pricesJob = await this.syncService.createJob({
      organizationId,
      marketplaceAccountId: masterAccount.id,
      jobType: 'prices',
      direction: 'inbound',
    });

    await this.inboundPricesQueue.add(
      'sync-prices',
      {
        syncJobId: pricesJob.id,
        organizationId,
        marketplaceAccountId: masterAccount.id,
        marketplace: masterAccount.marketplace,
      },
      {
        jobId: `inbound-prices-${pricesJob.id}`,
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
        // Start after products sync with delay
        delay: 60000,
      },
    );
    jobs.push(pricesJob);

    // 3. Queue outbound sync to slaves (will run after inbound completes)
    const slaveAccounts = await this.accountsService.findSlaves(organizationId);

    for (const slaveAccount of slaveAccounts) {
      const outboundJob = await this.syncService.createJob({
        organizationId,
        marketplaceAccountId: slaveAccount.id,
        jobType: 'full',
        direction: 'outbound',
      });

      await this.outboundProductsQueue.add(
        'sync-products',
        {
          syncJobId: outboundJob.id,
          organizationId,
          marketplaceAccountId: slaveAccount.id,
          marketplace: slaveAccount.marketplace,
        },
        {
          jobId: `outbound-products-${outboundJob.id}`,
          attempts: 3,
          backoff: { type: 'exponential', delay: 5000 },
          // Delay to let inbound complete
          delay: 120000,
        },
      );

      await this.outboundPricesQueue.add(
        'sync-prices',
        {
          syncJobId: outboundJob.id,
          organizationId,
          marketplaceAccountId: slaveAccount.id,
          marketplace: slaveAccount.marketplace,
        },
        {
          jobId: `outbound-prices-${outboundJob.id}`,
          attempts: 3,
          backoff: { type: 'exponential', delay: 5000 },
          delay: 180000,
        },
      );

      jobs.push(outboundJob);
    }

    return jobs;
  }

  /**
   * Sync products from master marketplace
   */
  async syncProducts(dto: SyncProductsDto): Promise<SyncJob> {
    const { organizationId, productIds, includeOutbound } = dto;

    const masterAccount = await this.accountsService.findMaster(organizationId);
    if (!masterAccount) {
      throw new BadRequestException('Master marketplace not configured');
    }

    const syncJob = await this.syncService.createJob({
      organizationId,
      marketplaceAccountId: masterAccount.id,
      jobType: 'products',
      direction: 'inbound',
    });

    await this.inboundProductsQueue.add(
      'sync-products',
      {
        syncJobId: syncJob.id,
        organizationId,
        marketplaceAccountId: masterAccount.id,
        marketplace: masterAccount.marketplace,
        productIds,
      },
      {
        jobId: `inbound-products-${syncJob.id}`,
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
      },
    );

    // Queue outbound to slaves if requested
    if (includeOutbound) {
      const slaveAccounts =
        await this.accountsService.findSlaves(organizationId);

      for (const slaveAccount of slaveAccounts) {
        await this.outboundProductsQueue.add(
          'sync-products',
          {
            syncJobId: syncJob.id,
            organizationId,
            marketplaceAccountId: slaveAccount.id,
            marketplace: slaveAccount.marketplace,
            productIds,
          },
          {
            jobId: `outbound-products-${slaveAccount.id}-${syncJob.id}`,
            attempts: 3,
            backoff: { type: 'exponential', delay: 5000 },
            delay: 60000, // Wait for inbound to complete
          },
        );
      }
    }

    return syncJob;
  }

  /**
   * Sync prices from master marketplace and propagate to slaves
   */
  async syncPrices(dto: SyncPricesDto): Promise<SyncJob> {
    const { organizationId, productIds } = dto;

    const masterAccount = await this.accountsService.findMaster(organizationId);
    if (!masterAccount) {
      throw new BadRequestException('Master marketplace not configured');
    }

    const syncJob = await this.syncService.createJob({
      organizationId,
      marketplaceAccountId: masterAccount.id,
      jobType: 'prices',
      direction: 'inbound',
    });

    // Inbound from master
    await this.inboundPricesQueue.add(
      'sync-prices',
      {
        syncJobId: syncJob.id,
        organizationId,
        marketplaceAccountId: masterAccount.id,
        marketplace: masterAccount.marketplace,
        productIds,
      },
      {
        jobId: `inbound-prices-${syncJob.id}`,
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
      },
    );

    // Outbound to slaves
    const slaveAccounts = await this.accountsService.findSlaves(organizationId);

    for (const slaveAccount of slaveAccounts) {
      await this.outboundPricesQueue.add(
        'sync-prices',
        {
          syncJobId: syncJob.id,
          organizationId,
          marketplaceAccountId: slaveAccount.id,
          marketplace: slaveAccount.marketplace,
          productIds,
        },
        {
          jobId: `outbound-prices-${slaveAccount.id}-${syncJob.id}`,
          attempts: 3,
          backoff: { type: 'exponential', delay: 5000 },
          delay: 30000,
        },
      );
    }

    return syncJob;
  }

  /**
   * Sync stocks to ALL marketplaces (bidirectional)
   */
  async syncStocks(dto: SyncStocksDto): Promise<SyncJob> {
    const { organizationId, productIds, warehouseId } = dto;

    const accounts = await this.accountsService.findAllActive(organizationId);

    if (accounts.length === 0) {
      throw new BadRequestException('No active marketplace accounts');
    }

    const syncJob = await this.syncService.createJob({
      organizationId,
      jobType: 'stocks',
      direction: 'outbound',
    });

    // Sync stocks to ALL marketplaces
    for (const account of accounts) {
      await this.stockUpdateQueue.add(
        'sync-all-stocks',
        {
          syncJobId: syncJob.id,
          organizationId,
          marketplaceAccountId: account.id,
          marketplace: account.marketplace,
          productIds,
          warehouseId,
        },
        {
          jobId: `sync-stocks-${account.id}-${syncJob.id}`,
          attempts: 5,
          backoff: { type: 'exponential', delay: 5000 },
        },
      );
    }

    return syncJob;
  }

  /**
   * Trigger order polling for all accounts
   */
  async triggerOrderPoll(organizationId: string): Promise<void> {
    const accounts = await this.accountsService.findAllActive(organizationId);

    for (const account of accounts) {
      await this.orderPollQueue.add(
        `poll:${account.marketplace}`,
        {
          marketplaceAccountId: account.id,
          organizationId,
          marketplace: account.marketplace,
        },
        {
          jobId: `order-poll-${account.id}-${Date.now()}`,
          attempts: 3,
          backoff: { type: 'exponential', delay: 10000 },
        },
      );
    }

    this.logger.log(
      `Triggered order poll for ${accounts.length} accounts in org ${organizationId}`,
    );
  }

  /**
   * Propagate product/price changes to slave marketplaces
   */
  async propagateToSlaves(
    organizationId: string,
    canonicalProductId: string,
    changeType: 'product' | 'price',
  ): Promise<void> {
    const slaveAccounts = await this.accountsService.findSlaves(organizationId);

    for (const account of slaveAccounts) {
      const idempotencyKey = `${canonicalProductId}-${account.id}-${Date.now()}`;

      if (changeType === 'product') {
        await this.outboundProductsQueue.add('sync-product', {
          canonicalProductId,
          marketplaceAccountId: account.id,
          marketplace: account.marketplace,
          operation: 'update',
          idempotencyKey,
        });
      } else if (changeType === 'price') {
        await this.outboundPricesQueue.add('sync-price', {
          canonicalProductId,
          marketplaceAccountId: account.id,
          marketplace: account.marketplace,
          idempotencyKey,
        });
      }
    }
  }

  /**
   * Get status of all sync queues
   */
  async getSyncStatus(organizationId: string): Promise<SyncStatusResponseDto> {
    const queueStatuses: QueueStatusDto[] = [];

    for (const [name, queue] of this.queues) {
      const [waiting, active, completed, failed, delayed] = await Promise.all([
        queue.getWaitingCount(),
        queue.getActiveCount(),
        queue.getCompletedCount(),
        queue.getFailedCount(),
        queue.getDelayedCount(),
      ]);

      const isPaused = await queue.isPaused();

      queueStatuses.push({
        name,
        waiting,
        active,
        completed,
        failed,
        delayed,
        paused: isPaused,
      });
    }

    // Get active jobs count
    const activeJobs = queueStatuses.reduce((sum, q) => sum + q.active, 0);
    const isRunning = activeJobs > 0;

    // Get last sync times
    const lastSync = await this.syncService.getLastSyncTimes(organizationId);

    return {
      isRunning,
      activeJobs,
      queues: queueStatuses,
      lastSync,
    };
  }

  /**
   * Pause all sync queues
   */
  async pauseSync(): Promise<void> {
    for (const [name, queue] of this.queues) {
      await queue.pause();
      this.logger.log(`Paused queue: ${name}`);
    }
  }

  /**
   * Resume all sync queues
   */
  async resumeSync(): Promise<void> {
    for (const [name, queue] of this.queues) {
      await queue.resume();
      this.logger.log(`Resumed queue: ${name}`);
    }
  }

  /**
   * Clear failed jobs from all queues
   */
  async clearFailedJobs(): Promise<number> {
    let totalCleared = 0;

    for (const [name, queue] of this.queues) {
      const failed = await queue.getFailed();
      for (const job of failed) {
        await job.remove();
        totalCleared++;
      }
      this.logger.log(`Cleared ${failed.length} failed jobs from ${name}`);
    }

    return totalCleared;
  }
}
