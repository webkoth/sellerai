import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CanonicalProduct, ProductMarketplaceMapping } from '@hubmarket/core';

interface FindAllParams {
  page: number;
  limit: number;
  status?: string;
}

@Injectable()
export class ProductsService {
  constructor(
    @InjectRepository(CanonicalProduct)
    private readonly productRepository: Repository<CanonicalProduct>,
    @InjectRepository(ProductMarketplaceMapping)
    private readonly mappingRepository: Repository<ProductMarketplaceMapping>,
  ) {}

  async findAll(params: FindAllParams) {
    const { page, limit, status } = params;
    const skip = (page - 1) * limit;

    const queryBuilder = this.productRepository.createQueryBuilder('product');

    if (status) {
      queryBuilder.where('product.status = :status', { status });
    }

    const [items, total] = await queryBuilder
      .orderBy('product.updatedAt', 'DESC')
      .skip(skip)
      .take(limit)
      .getManyAndCount();

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findById(id: string): Promise<CanonicalProduct> {
    const product = await this.productRepository.findOne({ where: { id } });
    if (!product) {
      throw new NotFoundException(`Product ${id} not found`);
    }
    return product;
  }

  async findBySku(internalSku: string): Promise<CanonicalProduct | null> {
    return this.productRepository.findOne({ where: { internalSku } });
  }

  async getMappings(productId: string): Promise<ProductMarketplaceMapping[]> {
    return this.mappingRepository.find({
      where: { canonicalProductId: productId },
      relations: ['marketplaceAccount'],
    });
  }

  async findByExternalId(
    marketplaceAccountId: string,
    externalId: string,
  ): Promise<CanonicalProduct | null> {
    const mapping = await this.mappingRepository.findOne({
      where: { marketplaceAccountId, externalId },
      relations: ['canonicalProduct'],
    });
    return mapping?.canonicalProduct || null;
  }

  async upsert(
    product: Partial<CanonicalProduct>,
    mapping?: {
      marketplaceAccountId: string;
      externalId: string;
      externalSku?: string;
      marketplaceData?: Record<string, unknown>;
    },
  ): Promise<CanonicalProduct> {
    let savedProduct: CanonicalProduct;

    if (product.id) {
      const existing = await this.findById(product.id);
      Object.assign(existing, product);
      savedProduct = await this.productRepository.save(existing);
    } else {
      const newProduct = this.productRepository.create(product);
      savedProduct = await this.productRepository.save(newProduct);
    }

    if (mapping) {
      await this.upsertMapping(savedProduct.id, mapping);
    }

    return savedProduct;
  }

  private async upsertMapping(
    canonicalProductId: string,
    mapping: {
      marketplaceAccountId: string;
      externalId: string;
      externalSku?: string;
      marketplaceData?: Record<string, unknown>;
    },
  ): Promise<void> {
    const existing = await this.mappingRepository.findOne({
      where: {
        canonicalProductId,
        marketplaceAccountId: mapping.marketplaceAccountId,
      },
    });

    if (existing) {
      Object.assign(existing, mapping, { lastSyncAt: new Date() });
      await this.mappingRepository.save(existing);
    } else {
      const newMapping = this.mappingRepository.create({
        canonicalProductId,
        ...mapping,
        syncStatus: 'synced',
        lastSyncAt: new Date(),
      });
      await this.mappingRepository.save(newMapping);
    }
  }
}
