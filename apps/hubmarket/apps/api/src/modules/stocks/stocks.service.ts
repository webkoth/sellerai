import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { InjectQueue } from '@nestjs/bullmq';
import { Repository } from 'typeorm';
import { Queue } from 'bullmq';
import {
  CanonicalProduct,
  ProductMarketplaceMapping,
  StockLevel,
  StockSyncEvent,
} from '@hubmarket/core';
import { QUEUE_NAMES } from '@hubmarket/queues';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class StocksService {
  constructor(
    @InjectRepository(CanonicalProduct)
    private readonly productRepository: Repository<CanonicalProduct>,
    @InjectRepository(ProductMarketplaceMapping)
    private readonly mappingRepository: Repository<ProductMarketplaceMapping>,
    @InjectRepository(StockLevel)
    private readonly stockLevelRepository: Repository<StockLevel>,
    @InjectRepository(StockSyncEvent)
    private readonly stockSyncEventRepository: Repository<StockSyncEvent>,
    @InjectQueue(QUEUE_NAMES.ORDERS_STOCK_UPDATE)
    private readonly stockUpdateQueue: Queue,
  ) {}

  async getProductStocks(productId: string) {
    const product = await this.productRepository.findOne({
      where: { id: productId },
    });

    const stockLevels = await this.stockLevelRepository.find({
      where: { canonicalProductId: productId },
    });

    const mappings = await this.mappingRepository.find({
      where: { canonicalProductId: productId },
      relations: ['marketplaceAccount'],
    });

    return {
      canonical: {
        totalStock: product?.totalStock,
      },
      warehouses: stockLevels.map((sl) => ({
        warehouseId: sl.warehouseId,
        available: sl.available,
        reserved: sl.reserved,
        safetyBuffer: sl.safetyBuffer,
      })),
      marketplaces: mappings.map((m) => ({
        accountId: m.marketplaceAccountId,
        marketplace: m.marketplaceAccount?.marketplace,
        currentStock: m.currentStock,
        lastSyncAt: m.lastSyncAt,
      })),
    };
  }

  async updateStock(
    productId: string,
    data: { available: number; warehouseId?: string },
  ) {
    // Update canonical total stock
    await this.productRepository.update(productId, {
      totalStock: data.available,
      updatedAt: new Date(),
    });

    // Trigger stock sync to all marketplaces
    await this.triggerStockSync(productId, data.available, 'manual');

    return this.getProductStocks(productId);
  }

  async updateCanonicalStock(
    productId: string,
    delta: number,
  ): Promise<number> {
    const product = await this.productRepository.findOne({
      where: { id: productId },
    });

    if (!product) {
      throw new Error(`Product ${productId} not found`);
    }

    const newStock = Math.max(0, (product.totalStock || 0) + delta);

    await this.productRepository.update(productId, {
      totalStock: newStock,
      updatedAt: new Date(),
    });

    return newStock;
  }

  async triggerStockSync(
    productId: string,
    newStock: number,
    reason: 'order' | 'manual' | 'sync',
    sourceMarketplaceAccountId?: string,
    sourceOrderId?: string,
  ): Promise<void> {
    const idempotencyKey = `stock-${productId}-${Date.now()}-${uuidv4()}`;

    await this.stockUpdateQueue.add(
      'update-stock',
      {
        canonicalProductId: productId,
        newStock,
        reason,
        sourceMarketplaceAccountId,
        sourceOrderId,
        idempotencyKey,
      },
      {
        jobId: idempotencyKey,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 5000,
        },
      },
    );
  }

  async recordStockSyncEvent(
    productId: string,
    delta: number,
    reason: string,
    sourceMarketplaceAccountId?: string,
    sourceOrderId?: string,
  ): Promise<StockSyncEvent> {
    const event = this.stockSyncEventRepository.create({
      canonicalProductId: productId,
      delta,
      reason,
      sourceMarketplaceAccountId,
      sourceOrderId,
      syncedTo: [],
    });

    return this.stockSyncEventRepository.save(event);
  }
}
