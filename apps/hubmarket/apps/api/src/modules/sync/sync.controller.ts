import {
  Controller,
  Post,
  Get,
  Param,
  Query,
  Body,
  Delete,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
  ParseIntPipe,
  DefaultValuePipe,
} from '@nestjs/common';
import { SyncService } from './sync.service';
import { SyncOrchestrator } from './sync.orchestrator';
import {
  StartSyncDto,
  SyncProductsDto,
  SyncPricesDto,
  SyncStocksDto,
  SyncType,
} from './dto/sync.dto';

@Controller('sync')
export class SyncController {
  constructor(
    private readonly syncService: SyncService,
    private readonly syncOrchestrator: SyncOrchestrator,
  ) {}

  /**
   * Start a sync operation
   * POST /sync
   */
  @Post()
  @HttpCode(HttpStatus.ACCEPTED)
  async startSync(@Body() dto: StartSyncDto) {
    const jobs = await this.syncOrchestrator.startSync(dto);
    return {
      message: `Started ${dto.type} sync`,
      jobs: jobs.map((job) => ({
        id: job.id,
        type: job.jobType,
        direction: job.direction,
        status: job.status,
      })),
    };
  }

  /**
   * Start full sync (products + prices from master, propagate to slaves)
   * POST /sync/full
   */
  @Post('full')
  @HttpCode(HttpStatus.ACCEPTED)
  async startFullSync(
    @Query('organizationId', ParseUUIDPipe) organizationId: string,
  ) {
    const jobs = await this.syncOrchestrator.startFullSync(organizationId);
    return {
      message: 'Full sync started',
      jobs: jobs.map((job) => ({
        id: job.id,
        type: job.jobType,
        direction: job.direction,
        status: job.status,
      })),
    };
  }

  /**
   * Sync products
   * POST /sync/products
   */
  @Post('products')
  @HttpCode(HttpStatus.ACCEPTED)
  async syncProducts(@Body() dto: SyncProductsDto) {
    const job = await this.syncOrchestrator.syncProducts(dto);
    return {
      message: 'Products sync started',
      job: {
        id: job.id,
        type: job.jobType,
        direction: job.direction,
        status: job.status,
      },
    };
  }

  /**
   * Sync prices
   * POST /sync/prices
   */
  @Post('prices')
  @HttpCode(HttpStatus.ACCEPTED)
  async syncPrices(@Body() dto: SyncPricesDto) {
    const job = await this.syncOrchestrator.syncPrices(dto);
    return {
      message: 'Prices sync started',
      job: {
        id: job.id,
        type: job.jobType,
        direction: job.direction,
        status: job.status,
      },
    };
  }

  /**
   * Sync stocks to all marketplaces
   * POST /sync/stocks
   */
  @Post('stocks')
  @HttpCode(HttpStatus.ACCEPTED)
  async syncStocks(@Body() dto: SyncStocksDto) {
    const job = await this.syncOrchestrator.syncStocks(dto);
    return {
      message: 'Stocks sync started',
      job: {
        id: job.id,
        type: job.jobType,
        direction: job.direction,
        status: job.status,
      },
    };
  }

  /**
   * Trigger order polling for all accounts
   * POST /sync/orders/poll
   */
  @Post('orders/poll')
  @HttpCode(HttpStatus.ACCEPTED)
  async triggerOrderPoll(
    @Query('organizationId', ParseUUIDPipe) organizationId: string,
  ) {
    await this.syncOrchestrator.triggerOrderPoll(organizationId);
    return { message: 'Order polling triggered' };
  }

  /**
   * Get sync status (queues, active jobs)
   * GET /sync/status
   */
  @Get('status')
  async getSyncStatus(
    @Query('organizationId', ParseUUIDPipe) organizationId: string,
  ) {
    return this.syncOrchestrator.getSyncStatus(organizationId);
  }

  /**
   * Get sync jobs list
   * GET /sync/jobs
   */
  @Get('jobs')
  async getSyncJobs(
    @Query('organizationId', ParseUUIDPipe) organizationId: string,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('status') status?: string,
    @Query('jobType') jobType?: string,
  ) {
    const jobs = await this.syncService.getRecentJobs(organizationId, limit, {
      status,
      jobType,
    });

    return {
      jobs: jobs.map((job) => ({
        id: job.id,
        marketplaceAccountId: job.marketplaceAccountId,
        type: job.jobType,
        direction: job.direction,
        status: job.status,
        progress: job.totalItems
          ? Math.round((job.processedItems / job.totalItems) * 100)
          : 0,
        totalItems: job.totalItems,
        processedItems: job.processedItems,
        successItems: job.successItems,
        failedItems: job.failedItems,
        startedAt: job.startedAt,
        completedAt: job.completedAt,
        createdAt: job.createdAt,
      })),
      total: jobs.length,
    };
  }

  /**
   * Get active sync jobs
   * GET /sync/jobs/active
   */
  @Get('jobs/active')
  async getActiveJobs(
    @Query('organizationId', ParseUUIDPipe) organizationId: string,
  ) {
    const jobs = await this.syncService.getActiveJobs(organizationId);
    return { jobs, count: jobs.length };
  }

  /**
   * Get sync job by ID
   * GET /sync/jobs/:id
   */
  @Get('jobs/:id')
  async getSyncJob(@Param('id', ParseUUIDPipe) id: string) {
    const job = await this.syncService.getJobById(id);
    return {
      ...job,
      progress: job.totalItems
        ? Math.round((job.processedItems / job.totalItems) * 100)
        : 0,
    };
  }

  /**
   * Get sync statistics
   * GET /sync/stats
   */
  @Get('stats')
  async getSyncStats(
    @Query('organizationId', ParseUUIDPipe) organizationId: string,
    @Query('since') since?: string,
  ) {
    const sinceDate = since ? new Date(since) : undefined;
    return this.syncService.getJobStats(organizationId, sinceDate);
  }

  /**
   * Cancel a sync job
   * DELETE /sync/jobs/:id
   */
  @Delete('jobs/:id')
  async cancelJob(@Param('id', ParseUUIDPipe) id: string) {
    const job = await this.syncService.cancelJob(id);
    return {
      message: 'Job cancelled',
      job: {
        id: job.id,
        status: job.status,
      },
    };
  }

  /**
   * Retry a failed sync job
   * POST /sync/jobs/:id/retry
   */
  @Post('jobs/:id/retry')
  @HttpCode(HttpStatus.ACCEPTED)
  async retryJob(@Param('id', ParseUUIDPipe) id: string) {
    const newJob = await this.syncService.retryJob(id);
    return {
      message: 'Job retry started',
      job: {
        id: newJob.id,
        type: newJob.jobType,
        direction: newJob.direction,
        status: newJob.status,
      },
    };
  }

  /**
   * Pause all sync operations
   * POST /sync/pause
   */
  @Post('pause')
  @HttpCode(HttpStatus.OK)
  async pauseSync() {
    await this.syncOrchestrator.pauseSync();
    return { message: 'All sync queues paused' };
  }

  /**
   * Resume all sync operations
   * POST /sync/resume
   */
  @Post('resume')
  @HttpCode(HttpStatus.OK)
  async resumeSync() {
    await this.syncOrchestrator.resumeSync();
    return { message: 'All sync queues resumed' };
  }

  /**
   * Clear failed jobs from all queues
   * DELETE /sync/failed
   */
  @Delete('failed')
  async clearFailedJobs() {
    const count = await this.syncOrchestrator.clearFailedJobs();
    return { message: `Cleared ${count} failed jobs` };
  }
}
