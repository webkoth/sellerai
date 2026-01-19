import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CanonicalProduct, ProductMarketplaceMapping } from '@hubmarket/core';

@Injectable()
export class PricesService {
  constructor(
    @InjectRepository(CanonicalProduct)
    private readonly productRepository: Repository<CanonicalProduct>,
    @InjectRepository(ProductMarketplaceMapping)
    private readonly mappingRepository: Repository<ProductMarketplaceMapping>,
  ) {}

  async getProductPrices(productId: string) {
    const product = await this.productRepository.findOne({
      where: { id: productId },
    });

    const mappings = await this.mappingRepository.find({
      where: { canonicalProductId: productId },
      relations: ['marketplaceAccount'],
    });

    return {
      canonical: {
        basePrice: product?.basePrice,
        minPrice: product?.minPrice,
      },
      marketplaces: mappings.map((m) => ({
        accountId: m.marketplaceAccountId,
        marketplace: m.marketplaceAccount?.marketplace,
        currentPrice: m.currentPrice,
        lastSyncAt: m.lastSyncAt,
      })),
    };
  }

  async updatePrice(
    productId: string,
    data: { basePrice: number; minPrice?: number },
  ) {
    await this.productRepository.update(productId, {
      basePrice: data.basePrice,
      minPrice: data.minPrice,
      updatedAt: new Date(),
    });

    // TODO: Trigger price sync to all marketplaces
    return this.getProductPrices(productId);
  }
}
