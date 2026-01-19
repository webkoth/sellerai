import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { ProductMarketplaceMapping } from '../database/entities/product-marketplace-mapping.entity';
import { CanonicalProduct } from '../database/entities/canonical-product.entity';
import { CircuitBreakerService, CircuitState } from './circuit-breaker.service';

export enum FailSafeAction {
  ZERO_STOCK = 'zero_stock',
  DISABLE_SYNC = 'disable_sync',
  ALERT_ONLY = 'alert_only',
}

export interface FailSafeEvent {
  timestamp: Date;
  serviceId: string;
  action: FailSafeAction;
  reason: string;
  affectedProducts?: number;
  details?: Record<string, unknown>;
}

@Injectable()
export class FailSafeService {
  private readonly logger = new Logger(FailSafeService.name);
  private readonly events: FailSafeEvent[] = [];
  private readonly MAX_EVENTS = 1000;

  constructor(
    @InjectRepository(ProductMarketplaceMapping)
    private readonly mappingRepo: Repository<ProductMarketplaceMapping>,
    @InjectRepository(CanonicalProduct)
    private readonly productRepo: Repository<CanonicalProduct>,
    private readonly circuitBreaker: CircuitBreakerService,
  ) {}

  /**
   * Handle critical error - set stocks to zero to prevent overselling
   */
  async handleCriticalError(
    marketplaceAccountId: string,
    reason: string,
    productIds?: string[],
  ): Promise<FailSafeEvent> {
    this.logger.error(
      `FAIL-SAFE: Critical error for account ${marketplaceAccountId}: ${reason}`,
    );

    // Set stocks to zero for affected products
    const affectedCount = await this.setStocksToZero(marketplaceAccountId, productIds);

    const event: FailSafeEvent = {
      timestamp: new Date(),
      serviceId: marketplaceAccountId,
      action: FailSafeAction.ZERO_STOCK,
      reason,
      affectedProducts: affectedCount,
    };

    this.recordEvent(event);

    return event;
  }

  /**
   * Set stocks to zero for specific marketplace account
   */
  async setStocksToZero(
    marketplaceAccountId: string,
    productIds?: string[],
  ): Promise<number> {
    const queryBuilder = this.mappingRepo
      .createQueryBuilder()
      .update(ProductMarketplaceMapping)
      .set({
        currentStock: 0,
        syncStatus: 'error',
        lastError: 'Fail-safe: stock set to zero due to critical error',
        lastSyncAt: new Date(),
      })
      .where('marketplaceAccountId = :marketplaceAccountId', { marketplaceAccountId });

    if (productIds && productIds.length > 0) {
      queryBuilder.andWhere('canonicalProductId IN (:...productIds)', { productIds });
    }

    const result = await queryBuilder.execute();
    const affectedCount = result.affected || 0;

    this.logger.warn(
      `FAIL-SAFE: Set ${affectedCount} product stocks to zero for account ${marketplaceAccountId}`,
    );

    return affectedCount;
  }

  /**
   * Check if marketplace is in fail-safe mode (circuit open)
   */
  isInFailSafeMode(marketplaceAccountId: string): boolean {
    return this.circuitBreaker.getState(marketplaceAccountId) === CircuitState.OPEN;
  }

  /**
   * Handle repeated sync failures
   */
  async handleRepeatedFailures(
    marketplaceAccountId: string,
    failureCount: number,
    threshold: number = 10,
  ): Promise<void> {
    if (failureCount >= threshold) {
      this.logger.error(
        `FAIL-SAFE: ${failureCount} consecutive failures for account ${marketplaceAccountId}`,
      );

      // Open circuit breaker
      this.circuitBreaker.forceState(marketplaceAccountId, CircuitState.OPEN);

      // Set stocks to zero
      await this.handleCriticalError(
        marketplaceAccountId,
        `Exceeded failure threshold: ${failureCount} failures`,
      );
    }
  }

  /**
   * Handle API rate limit exceeded
   */
  async handleRateLimitExceeded(
    marketplaceAccountId: string,
    retryAfter?: number,
  ): Promise<void> {
    this.logger.warn(
      `FAIL-SAFE: Rate limit exceeded for account ${marketplaceAccountId}`,
    );

    // Open circuit with appropriate timeout
    this.circuitBreaker.configure(marketplaceAccountId, {
      timeout: retryAfter ? retryAfter * 1000 : 60000,
    });
    this.circuitBreaker.forceState(marketplaceAccountId, CircuitState.OPEN);

    this.recordEvent({
      timestamp: new Date(),
      serviceId: marketplaceAccountId,
      action: FailSafeAction.DISABLE_SYNC,
      reason: 'Rate limit exceeded',
      details: { retryAfter },
    });
  }

  /**
   * Handle authentication error
   */
  async handleAuthError(
    marketplaceAccountId: string,
    error: string,
  ): Promise<void> {
    this.logger.error(
      `FAIL-SAFE: Authentication error for account ${marketplaceAccountId}: ${error}`,
    );

    // Open circuit indefinitely until fixed
    this.circuitBreaker.configure(marketplaceAccountId, {
      timeout: 24 * 60 * 60 * 1000, // 24 hours
    });
    this.circuitBreaker.forceState(marketplaceAccountId, CircuitState.OPEN);

    this.recordEvent({
      timestamp: new Date(),
      serviceId: marketplaceAccountId,
      action: FailSafeAction.DISABLE_SYNC,
      reason: `Authentication error: ${error}`,
    });
  }

  /**
   * Recover from fail-safe mode
   */
  async recover(marketplaceAccountId: string): Promise<void> {
    this.logger.log(
      `FAIL-SAFE: Recovering account ${marketplaceAccountId} from fail-safe mode`,
    );

    // Reset circuit breaker
    this.circuitBreaker.forceState(marketplaceAccountId, CircuitState.CLOSED);

    // Reset sync status for affected products
    await this.mappingRepo
      .createQueryBuilder()
      .update(ProductMarketplaceMapping)
      .set({
        syncStatus: 'pending',
        lastError: null,
      })
      .where('marketplaceAccountId = :marketplaceAccountId', { marketplaceAccountId })
      .andWhere('syncStatus = :status', { status: 'error' })
      .execute();

    this.recordEvent({
      timestamp: new Date(),
      serviceId: marketplaceAccountId,
      action: FailSafeAction.ALERT_ONLY,
      reason: 'Recovered from fail-safe mode',
    });
  }

  /**
   * Get recent fail-safe events
   */
  getRecentEvents(limit: number = 100): FailSafeEvent[] {
    return this.events.slice(-limit);
  }

  /**
   * Get events for specific service
   */
  getEventsForService(serviceId: string, limit: number = 50): FailSafeEvent[] {
    return this.events
      .filter((e) => e.serviceId === serviceId)
      .slice(-limit);
  }

  /**
   * Get current fail-safe status for all services
   */
  getStatus(): Record<string, { inFailSafe: boolean; state: CircuitState }> {
    const allStats = this.circuitBreaker.getAllStats();
    const result: Record<string, { inFailSafe: boolean; state: CircuitState }> = {};

    for (const [serviceId, stats] of Object.entries(allStats)) {
      result[serviceId] = {
        inFailSafe: stats.state === CircuitState.OPEN,
        state: stats.state,
      };
    }

    return result;
  }

  private recordEvent(event: FailSafeEvent): void {
    this.events.push(event);

    // Keep only last MAX_EVENTS
    if (this.events.length > this.MAX_EVENTS) {
      this.events.splice(0, this.events.length - this.MAX_EVENTS);
    }
  }
}
