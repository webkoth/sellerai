import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { SyncJob, SyncJobStatus } from '@hubmarket/core';

export interface LastSyncTimes {
  products?: Date;
  prices?: Date;
  stocks?: Date;
}

@Injectable()
export class SyncService {
  constructor(
    @InjectRepository(SyncJob)
    private readonly syncJobRepository: Repository<SyncJob>,
  ) {}

  async createJob(data: Partial<SyncJob>): Promise<SyncJob> {
    const job = this.syncJobRepository.create({
      ...data,
      status: 'pending' as SyncJobStatus,
      totalItems: 0,
      processedItems: 0,
      successItems: 0,
      failedItems: 0,
      errors: [],
      startedAt: new Date(),
    });
    return this.syncJobRepository.save(job);
  }

  async updateJobStatus(
    jobId: string,
    status: SyncJobStatus,
    updates?: Partial<SyncJob>,
  ): Promise<void> {
    await this.syncJobRepository.update(jobId, {
      status,
      ...updates,
      ...(status === 'processing' ? { startedAt: new Date() } : {}),
      ...(status === 'completed' || status === 'failed'
        ? { completedAt: new Date() }
        : {}),
    });
  }

  async updateJobProgress(
    jobId: string,
    processedItems: number,
    successItems: number,
    failedItems: number,
  ): Promise<void> {
    await this.syncJobRepository.update(jobId, {
      processedItems,
      successItems,
      failedItems,
    });
  }

  async getJobById(id: string): Promise<SyncJob> {
    const job = await this.syncJobRepository.findOne({ where: { id } });
    if (!job) {
      throw new NotFoundException(`Sync job ${id} not found`);
    }
    return job;
  }

  async getJobByIdOrNull(id: string): Promise<SyncJob | null> {
    return this.syncJobRepository.findOne({ where: { id } });
  }

  async getRecentJobs(
    organizationId: string,
    limit: number,
    filters?: { status?: string; jobType?: string },
  ): Promise<SyncJob[]> {
    const where: Record<string, unknown> = { organizationId };

    if (filters?.status) {
      where.status = filters.status;
    }
    if (filters?.jobType) {
      where.jobType = filters.jobType;
    }

    return this.syncJobRepository.find({
      where,
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }

  async getActiveJobs(organizationId: string): Promise<SyncJob[]> {
    return this.syncJobRepository.find({
      where: {
        organizationId,
        status: In(['pending', 'processing']),
      },
      order: { createdAt: 'DESC' },
    });
  }

  async getLastSyncTimes(organizationId: string): Promise<LastSyncTimes> {
    const result: LastSyncTimes = {};

    // Get last completed products sync
    const productsSync = await this.syncJobRepository.findOne({
      where: {
        organizationId,
        jobType: 'products',
        status: 'completed' as SyncJobStatus,
      },
      order: { completedAt: 'DESC' },
    });
    if (productsSync?.completedAt) {
      result.products = productsSync.completedAt;
    }

    // Get last completed prices sync
    const pricesSync = await this.syncJobRepository.findOne({
      where: {
        organizationId,
        jobType: 'prices',
        status: 'completed' as SyncJobStatus,
      },
      order: { completedAt: 'DESC' },
    });
    if (pricesSync?.completedAt) {
      result.prices = pricesSync.completedAt;
    }

    // Get last completed stocks sync
    const stocksSync = await this.syncJobRepository.findOne({
      where: {
        organizationId,
        jobType: 'stocks',
        status: 'completed' as SyncJobStatus,
      },
      order: { completedAt: 'DESC' },
    });
    if (stocksSync?.completedAt) {
      result.stocks = stocksSync.completedAt;
    }

    return result;
  }

  async getJobStats(
    organizationId: string,
    since?: Date,
  ): Promise<{
    total: number;
    completed: number;
    failed: number;
    pending: number;
    processing: number;
  }> {
    const queryBuilder = this.syncJobRepository
      .createQueryBuilder('job')
      .where('job.organizationId = :organizationId', { organizationId });

    if (since) {
      queryBuilder.andWhere('job.createdAt >= :since', { since });
    }

    const [total, completed, failed, pending, processing] = await Promise.all([
      queryBuilder.getCount(),
      queryBuilder
        .clone()
        .andWhere('job.status = :status', { status: 'completed' })
        .getCount(),
      queryBuilder
        .clone()
        .andWhere('job.status = :status', { status: 'failed' })
        .getCount(),
      queryBuilder
        .clone()
        .andWhere('job.status = :status', { status: 'pending' })
        .getCount(),
      queryBuilder
        .clone()
        .andWhere('job.status = :status', { status: 'processing' })
        .getCount(),
    ]);

    return { total, completed, failed, pending, processing };
  }

  async cancelJob(jobId: string): Promise<SyncJob> {
    const job = await this.getJobById(jobId);

    if (job.status === 'completed' || job.status === 'failed') {
      throw new Error(`Cannot cancel job with status: ${job.status}`);
    }

    job.status = 'failed' as SyncJobStatus;
    job.completedAt = new Date();
    job.errors = [
      ...(job.errors || []),
      { message: 'Job cancelled by user', timestamp: new Date() },
    ];

    return this.syncJobRepository.save(job);
  }

  async retryJob(jobId: string): Promise<SyncJob> {
    const originalJob = await this.getJobById(jobId);

    if (originalJob.status !== 'failed') {
      throw new Error(`Can only retry failed jobs`);
    }

    // Create a new job with same parameters
    const newJob = await this.createJob({
      organizationId: originalJob.organizationId,
      marketplaceAccountId: originalJob.marketplaceAccountId,
      jobType: originalJob.jobType,
      direction: originalJob.direction,
    });

    return newJob;
  }
}
