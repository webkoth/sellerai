import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  CanonicalProduct,
  ProductMarketplaceMapping,
  MarketplaceAccount,
} from '@hubmarket/core';

@Injectable()
export class MarketplaceJobService {
  private readonly logger = new Logger(MarketplaceJobService.name);

  constructor(
    @InjectRepository(CanonicalProduct)
    private readonly productRepo: Repository<CanonicalProduct>,
    @InjectRepository(ProductMarketplaceMapping)
    private readonly mappingRepo: Repository<ProductMarketplaceMapping>,
    @InjectRepository(MarketplaceAccount)
    private readonly accountRepo: Repository<MarketplaceAccount>,
  ) {}

  /**
   * Get marketplace account with credentials
   */
  async getAccountWithCredentials(accountId: string): Promise<MarketplaceAccount | null> {
    return this.accountRepo.findOne({ where: { id: accountId } });
  }

  /**
   * Get product mapping with product details
   */
  async getMappingWithProduct(
    canonicalProductId: string,
    marketplaceAccountId: string,
  ): Promise<ProductMarketplaceMapping | null> {
    return this.mappingRepo.findOne({
      where: { canonicalProductId, marketplaceAccountId },
      relations: ['canonicalProduct'],
    });
  }

  /**
   * Update mapping's current stock
   */
  async updateMappingStock(
    mappingId: string,
    stock: number,
    syncStatus: 'synced' | 'error' = 'synced',
    lastError?: string,
  ): Promise<void> {
    await this.mappingRepo.update(mappingId, {
      currentStock: stock,
      syncStatus,
      lastError: lastError || null,
      lastSyncAt: new Date(),
    });
  }

  /**
   * Update mapping's current price
   */
  async updateMappingPrice(
    mappingId: string,
    price: number,
    syncStatus: 'synced' | 'error' = 'synced',
    lastError?: string,
  ): Promise<void> {
    await this.mappingRepo.update(mappingId, {
      currentPrice: price,
      syncStatus,
      lastError: lastError || null,
      lastSyncAt: new Date(),
    });
  }

  /**
   * Get canonical product by ID
   */
  async getProduct(productId: string): Promise<CanonicalProduct | null> {
    return this.productRepo.findOne({ where: { id: productId } });
  }
}
