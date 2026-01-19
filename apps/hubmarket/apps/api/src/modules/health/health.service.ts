import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { QUEUE_NAMES } from '@hubmarket/queues';
import Redis from 'ioredis';

export enum HealthStatus {
  HEALTHY = 'healthy',
  DEGRADED = 'degraded',
  UNHEALTHY = 'unhealthy',
}

export interface ComponentHealth {
  name: string;
  status: HealthStatus;
  latency?: number;
  message?: string;
  details?: Record<string, unknown>;
}

export interface SystemHealth {
  status: HealthStatus;
  timestamp: string;
  uptime: number;
  version: string;
  components: ComponentHealth[];
}

@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);
  private readonly startTime = Date.now();
  private redis: Redis | null = null;

  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
    @InjectQueue(QUEUE_NAMES.SYNC_INBOUND_PRODUCTS)
    private readonly sampleQueue: Queue,
  ) {
    // Get Redis client from queue
    this.redis = this.sampleQueue.client as unknown as Redis;
  }

  /**
   * Full health check of all components
   */
  async getHealth(): Promise<SystemHealth> {
    const components: ComponentHealth[] = await Promise.all([
      this.checkDatabase(),
      this.checkRedis(),
      this.checkQueues(),
    ]);

    const overallStatus = this.calculateOverallStatus(components);

    return {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      uptime: Math.floor((Date.now() - this.startTime) / 1000),
      version: process.env.npm_package_version || '0.0.1',
      components,
    };
  }

  /**
   * Liveness check (is the service running?)
   */
  async getLiveness(): Promise<{ status: string; timestamp: string }> {
    return {
      status: 'alive',
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Readiness check (is the service ready to accept traffic?)
   */
  async getReadiness(): Promise<{ ready: boolean; checks: ComponentHealth[] }> {
    const checks = await Promise.all([
      this.checkDatabase(),
      this.checkRedis(),
    ]);

    const ready = checks.every((c) => c.status !== HealthStatus.UNHEALTHY);

    return { ready, checks };
  }

  /**
   * Check database connection
   */
  private async checkDatabase(): Promise<ComponentHealth> {
    const start = Date.now();

    try {
      await this.dataSource.query('SELECT 1');
      const latency = Date.now() - start;

      return {
        name: 'database',
        status: latency > 1000 ? HealthStatus.DEGRADED : HealthStatus.HEALTHY,
        latency,
        details: {
          type: 'postgresql',
          connected: this.dataSource.isInitialized,
        },
      };
    } catch (error) {
      return {
        name: 'database',
        status: HealthStatus.UNHEALTHY,
        latency: Date.now() - start,
        message: error instanceof Error ? error.message : 'Database connection failed',
      };
    }
  }

  /**
   * Check Redis connection
   */
  private async checkRedis(): Promise<ComponentHealth> {
    const start = Date.now();

    try {
      if (!this.redis) {
        return {
          name: 'redis',
          status: HealthStatus.UNHEALTHY,
          message: 'Redis client not initialized',
        };
      }

      await this.redis.ping();
      const latency = Date.now() - start;

      const info = await this.redis.info('server');
      const versionMatch = info.match(/redis_version:(\S+)/);

      return {
        name: 'redis',
        status: latency > 500 ? HealthStatus.DEGRADED : HealthStatus.HEALTHY,
        latency,
        details: {
          version: versionMatch ? versionMatch[1] : 'unknown',
          connected: true,
        },
      };
    } catch (error) {
      return {
        name: 'redis',
        status: HealthStatus.UNHEALTHY,
        latency: Date.now() - start,
        message: error instanceof Error ? error.message : 'Redis connection failed',
      };
    }
  }

  /**
   * Check queues status
   */
  private async checkQueues(): Promise<ComponentHealth> {
    const start = Date.now();

    try {
      const [waiting, active, failed] = await Promise.all([
        this.sampleQueue.getWaitingCount(),
        this.sampleQueue.getActiveCount(),
        this.sampleQueue.getFailedCount(),
      ]);

      const isPaused = await this.sampleQueue.isPaused();
      const latency = Date.now() - start;

      // Degraded if too many failed jobs or paused
      const status = isPaused || failed > 100
        ? HealthStatus.DEGRADED
        : HealthStatus.HEALTHY;

      return {
        name: 'queues',
        status,
        latency,
        details: {
          waiting,
          active,
          failed,
          paused: isPaused,
        },
      };
    } catch (error) {
      return {
        name: 'queues',
        status: HealthStatus.UNHEALTHY,
        latency: Date.now() - start,
        message: error instanceof Error ? error.message : 'Queue check failed',
      };
    }
  }

  /**
   * Calculate overall status from component statuses
   */
  private calculateOverallStatus(components: ComponentHealth[]): HealthStatus {
    if (components.some((c) => c.status === HealthStatus.UNHEALTHY)) {
      return HealthStatus.UNHEALTHY;
    }
    if (components.some((c) => c.status === HealthStatus.DEGRADED)) {
      return HealthStatus.DEGRADED;
    }
    return HealthStatus.HEALTHY;
  }
}
