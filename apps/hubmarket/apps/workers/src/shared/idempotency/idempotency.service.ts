import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class IdempotencyService implements OnModuleInit, OnModuleDestroy {
  private redis: Redis;
  private readonly keyPrefix = 'idempotency:';
  private readonly defaultTtl = 24 * 60 * 60; // 24 hours

  constructor(private readonly configService: ConfigService) {}

  onModuleInit() {
    this.redis = new Redis({
      host: this.configService.get('redis.host'),
      port: this.configService.get('redis.port'),
      password: this.configService.get('redis.password'),
    });
  }

  onModuleDestroy() {
    this.redis?.disconnect();
  }

  /**
   * Check if a job with this key has already been processed
   */
  async isProcessed(key: string): Promise<boolean> {
    const result = await this.redis.get(this.keyPrefix + key);
    return result !== null;
  }

  /**
   * Mark a job as processed
   */
  async markProcessed(key: string, ttl?: number): Promise<void> {
    await this.redis.setex(
      this.keyPrefix + key,
      ttl || this.defaultTtl,
      Date.now().toString(),
    );
  }

  /**
   * Try to acquire a lock for processing (returns true if lock acquired)
   */
  async tryAcquire(key: string, ttl = 300): Promise<boolean> {
    const lockKey = `lock:${this.keyPrefix}${key}`;
    const result = await this.redis.set(lockKey, '1', 'EX', ttl, 'NX');
    return result === 'OK';
  }

  /**
   * Release a processing lock
   */
  async release(key: string): Promise<void> {
    const lockKey = `lock:${this.keyPrefix}${key}`;
    await this.redis.del(lockKey);
  }

  /**
   * Atomic check-and-mark: returns true if key was NOT processed before
   * and marks it as processed in one operation
   */
  async checkAndMark(key: string, ttl?: number): Promise<boolean> {
    const fullKey = this.keyPrefix + key;
    const result = await this.redis.set(
      fullKey,
      Date.now().toString(),
      'EX',
      ttl || this.defaultTtl,
      'NX',
    );
    return result === 'OK';
  }
}
