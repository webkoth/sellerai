import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import {
  CanonicalProduct,
  ProductMarketplaceMapping,
  MarketplaceAccount,
  StockLevel,
  StockSyncEvent,
  Order,
  MarketplaceType,
} from '@hubmarket/core';
import { QUEUE_NAMES } from '@hubmarket/queues';
import { IdempotencyService } from '../shared/idempotency/idempotency.service';

export interface StockUpdateJobData {
  canonicalProductId: string;
  organizationId: string;
  delta: number;
  sourceMarketplaceAccountId: string;
  sourceOrderId?: string;
  reason: 'order' | 'manual' | 'sync' | 'return';
  idempotencyKey: string;
}

export interface MarketplaceStockUpdateJobData {
  type: 'update-stock';
  canonicalProductId: string;
  marketplaceAccountId: string;
  newStock: number;
  warehouseId?: string;
}

@Injectable()
export class StockSyncService {
  private readonly logger = new Logger(StockSyncService.name);

  constructor(
    @InjectRepository(CanonicalProduct)
    private readonly productRepo: Repository<CanonicalProduct>,
    @InjectRepository(ProductMarketplaceMapping)
    private readonly mappingRepo: Repository<ProductMarketplaceMapping>,
    @InjectRepository(MarketplaceAccount)
    private readonly accountRepo: Repository<MarketplaceAccount>,
    @InjectRepository(StockLevel)
    private readonly stockLevelRepo: Repository<StockLevel>,
    @InjectRepository(StockSyncEvent)
    private readonly stockEventRepo: Repository<StockSyncEvent>,
    @InjectRepository(Order)
    private readonly orderRepo: Repository<Order>,
    @InjectQueue(QUEUE_NAMES.ORDERS_STOCK_UPDATE)
    private readonly stockUpdateQueue: Queue,
    @InjectQueue(QUEUE_NAMES.MP_WILDBERRIES_STOCKS)
    private readonly wbQueue: Queue,
    @InjectQueue(QUEUE_NAMES.MP_OZON)
    private readonly ozonQueue: Queue,
    @InjectQueue(QUEUE_NAMES.MP_YANDEX)
    private readonly yandexQueue: Queue,
    private readonly idempotencyService: IdempotencyService,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Queue a stock update from an order event
   * This is called when an order is detected on any marketplace
   */
  async queueStockUpdateFromOrder(
    order: Order,
    canonicalProductId: string,
    quantity: number,
  ): Promise<void> {
    const idempotencyKey = `order:${order.marketplaceAccountId}:${order.externalOrderId}:${canonicalProductId}`;

    await this.stockUpdateQueue.add(
      'update-stock',
      {
        canonicalProductId,
        organizationId: order.organizationId,
        delta: -quantity, // Orders reduce stock
        sourceMarketplaceAccountId: order.marketplaceAccountId,
        sourceOrderId: order.id,
        reason: 'order',
        idempotencyKey,
      } as StockUpdateJobData,
      {
        jobId: idempotencyKey,
        attempts: 5,
        backoff: { type: 'exponential', delay: 3000 },
      },
    );
  }

  /**
   * Queue a manual stock update
   */
  async queueManualStockUpdate(
    canonicalProductId: string,
    organizationId: string,
    newTotalStock: number,
    sourceAccountId?: string,
  ): Promise<void> {
    const product = await this.productRepo.findOne({
      where: { id: canonicalProductId },
    });

    if (!product) {
      throw new Error(`Product not found: ${canonicalProductId}`);
    }

    const delta = newTotalStock - (product.totalStock || 0);
    const idempotencyKey = `manual:${canonicalProductId}:${Date.now()}`;

    await this.stockUpdateQueue.add(
      'update-stock',
      {
        canonicalProductId,
        organizationId,
        delta,
        sourceMarketplaceAccountId: sourceAccountId || '',
        reason: 'manual',
        idempotencyKey,
      } as StockUpdateJobData,
      {
        jobId: idempotencyKey,
        attempts: 3,
        backoff: { type: 'exponential', delay: 3000 },
      },
    );
  }

  /**
   * Update canonical stock and return new value
   * Uses transaction to ensure consistency
   */
  async updateCanonicalStock(
    canonicalProductId: string,
    delta: number,
  ): Promise<number> {
    return this.dataSource.transaction(async (manager) => {
      const productRepo = manager.getRepository(CanonicalProduct);

      // Lock the row for update
      const product = await productRepo
        .createQueryBuilder('product')
        .setLock('pessimistic_write')
        .where('product.id = :id', { id: canonicalProductId })
        .getOne();

      if (!product) {
        throw new Error(`Product not found: ${canonicalProductId}`);
      }

      const currentStock = product.totalStock || 0;
      const newStock = Math.max(0, currentStock + delta); // Never go below 0

      await productRepo.update(canonicalProductId, {
        totalStock: newStock,
        updatedAt: new Date(),
      });

      return newStock;
    });
  }

  /**
   * Create stock sync event for audit
   */
  async createStockSyncEvent(
    data: Omit<StockSyncEvent, 'id' | 'createdAt'>,
  ): Promise<StockSyncEvent> {
    const event = this.stockEventRepo.create(data);
    return this.stockEventRepo.save(event);
  }

  /**
   * Update stock sync event with sync results
   */
  async updateStockSyncEvent(
    eventId: string,
    syncedTo: Array<{ accountId: string; status: 'pending' | 'success' | 'failed'; syncedAt?: Date; error?: string }>,
  ): Promise<void> {
    await this.stockEventRepo.update(eventId, { syncedTo });
  }

  /**
   * Get all active marketplace accounts for an organization
   */
  async getAllActiveAccounts(organizationId: string): Promise<MarketplaceAccount[]> {
    return this.accountRepo.find({
      where: { organizationId, isActive: true },
    });
  }

  /**
   * Get marketplace mapping for a product
   */
  async getProductMapping(
    canonicalProductId: string,
    marketplaceAccountId: string,
  ): Promise<ProductMarketplaceMapping | null> {
    return this.mappingRepo.findOne({
      where: { canonicalProductId, marketplaceAccountId },
    });
  }

  /**
   * Update mapping's current stock
   */
  async updateMappingStock(mappingId: string, stock: number): Promise<void> {
    await this.mappingRepo.update(mappingId, {
      currentStock: stock,
      lastSyncAt: new Date(),
    });
  }

  /**
   * Queue stock update to a specific marketplace
   */
  async queueMarketplaceStockUpdate(
    account: MarketplaceAccount,
    canonicalProductId: string,
    newStock: number,
    warehouseId?: string,
  ): Promise<void> {
    const queue = this.getMarketplaceQueue(account.marketplace);
    const jobData: MarketplaceStockUpdateJobData = {
      type: 'update-stock',
      canonicalProductId,
      marketplaceAccountId: account.id,
      newStock,
      warehouseId,
    };

    await queue.add(`stock-update:${canonicalProductId}`, jobData, {
      attempts: 5,
      backoff: { type: 'exponential', delay: 5000 },
    });
  }

  /**
   * Mark order as stock-updated
   */
  async markOrderStockUpdated(orderId: string): Promise<void> {
    await this.orderRepo.update(orderId, { stockUpdated: true });
  }

  /**
   * Check if stock update was already processed
   */
  async isStockUpdateProcessed(idempotencyKey: string): Promise<boolean> {
    return !(await this.idempotencyService.checkAndMark(
      `stock:${idempotencyKey}`,
      86400, // 24 hour TTL
    ));
  }

  /**
   * Get product with organization
   */
  async getProduct(canonicalProductId: string): Promise<CanonicalProduct | null> {
    return this.productRepo.findOne({
      where: { id: canonicalProductId },
    });
  }

  /**
   * Calculate effective stock (with safety buffer consideration)
   */
  async calculateEffectiveStock(
    canonicalProductId: string,
    warehouseId?: string,
  ): Promise<number> {
    // If warehouse-specific, get from stock_levels
    if (warehouseId) {
      const stockLevel = await this.stockLevelRepo.findOne({
        where: { canonicalProductId, warehouseId },
      });

      if (stockLevel) {
        return Math.max(
          0,
          stockLevel.available - (stockLevel.reserved || 0) - (stockLevel.safetyBuffer || 0),
        );
      }
    }

    // Otherwise, use total stock from canonical product
    const product = await this.productRepo.findOne({
      where: { id: canonicalProductId },
    });

    return Math.max(0, product?.totalStock || 0);
  }

  private getMarketplaceQueue(marketplace: MarketplaceType): Queue {
    switch (marketplace) {
      case 'wildberries':
        return this.wbQueue;
      case 'ozon':
        return this.ozonQueue;
      case 'yandex_market':
        return this.yandexQueue;
      default:
        throw new Error(`Unknown marketplace: ${marketplace}`);
    }
  }
}
