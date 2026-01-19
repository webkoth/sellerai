import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import {
  CanonicalProduct,
  ProductMarketplaceMapping,
  ProductBarcode,
  MarketplaceAccount,
  Order,
  MarketplaceType,
} from '@hubmarket/core';
import { QUEUE_NAMES } from '@hubmarket/queues';

export interface OrderPollJobData {
  marketplaceAccountId: string;
  organizationId: string;
  marketplace: MarketplaceType;
  lastPollTime?: string;
}

export interface OrderItem {
  sku: string;
  quantity: number;
  price?: number;
}

@Injectable()
export class OrderPollService {
  private readonly logger = new Logger(OrderPollService.name);

  constructor(
    @InjectRepository(CanonicalProduct)
    private readonly productRepo: Repository<CanonicalProduct>,
    @InjectRepository(ProductMarketplaceMapping)
    private readonly mappingRepo: Repository<ProductMarketplaceMapping>,
    @InjectRepository(ProductBarcode)
    private readonly barcodeRepo: Repository<ProductBarcode>,
    @InjectRepository(MarketplaceAccount)
    private readonly accountRepo: Repository<MarketplaceAccount>,
    @InjectRepository(Order)
    private readonly orderRepo: Repository<Order>,
    @InjectQueue(QUEUE_NAMES.ORDER_POLL)
    private readonly orderPollQueue: Queue,
  ) {}

  /**
   * Queue order poll job for a specific account
   */
  async queueOrderPoll(account: MarketplaceAccount): Promise<void> {
    await this.orderPollQueue.add(
      `poll:${account.marketplace}`,
      {
        marketplaceAccountId: account.id,
        organizationId: account.organizationId,
        marketplace: account.marketplace,
        lastPollTime: account.settings?.lastOrderPollTime as string | undefined,
      } as OrderPollJobData,
      {
        jobId: `poll:${account.id}:${Date.now()}`,
        attempts: 3,
        backoff: { type: 'exponential', delay: 10000 },
      },
    );
  }

  /**
   * Get all active marketplace accounts
   */
  async getAllActiveAccounts(): Promise<MarketplaceAccount[]> {
    return this.accountRepo.find({
      where: { isActive: true },
    });
  }

  /**
   * Get marketplace account with credentials
   */
  async getAccountWithCredentials(accountId: string): Promise<MarketplaceAccount | null> {
    return this.accountRepo.findOne({ where: { id: accountId } });
  }

  /**
   * Find or create order
   */
  async upsertOrder(
    organizationId: string,
    marketplaceAccountId: string,
    externalOrderId: string,
    status: string,
    items: OrderItem[],
  ): Promise<{ order: Order; isNew: boolean }> {
    let order = await this.orderRepo.findOne({
      where: { marketplaceAccountId, externalOrderId },
    });

    const isNew = !order;

    if (order) {
      // Update existing order
      order.status = status;
      order.items = items;
      order.updatedAt = new Date();
    } else {
      // Create new order
      order = this.orderRepo.create({
        organizationId,
        marketplaceAccountId,
        externalOrderId,
        status,
        items,
        stockUpdated: false,
      });
    }

    const savedOrder = await this.orderRepo.save(order);
    return { order: savedOrder, isNew };
  }

  /**
   * Find canonical product by SKU on marketplace
   */
  async findCanonicalProductBySku(
    marketplaceAccountId: string,
    sku: string,
  ): Promise<CanonicalProduct | null> {
    const mapping = await this.mappingRepo.findOne({
      where: [
        { marketplaceAccountId, externalSku: sku },
        { marketplaceAccountId, externalId: sku },
      ],
      relations: ['canonicalProduct'],
    });

    return mapping?.canonicalProduct || null;
  }

  /**
   * Find canonical product by internal SKU
   */
  async findCanonicalProductByInternalSku(
    organizationId: string,
    internalSku: string,
  ): Promise<CanonicalProduct | null> {
    return this.productRepo.findOne({
      where: { organizationId, internalSku },
    });
  }

  /**
   * Find canonical product by barcode (WB orders contain barcodes, not vendorCodes)
   * Searches in both canonical_products.barcode and product_barcodes table
   */
  async findCanonicalProductByBarcode(
    organizationId: string,
    barcode: string,
  ): Promise<CanonicalProduct | null> {
    // First try to find in canonical_products.barcode (legacy single barcode)
    const product = await this.productRepo.findOne({
      where: { organizationId, barcode },
    });

    if (product) {
      return product;
    }

    // Then try to find in product_barcodes table (multiple barcodes)
    const productBarcode = await this.barcodeRepo.findOne({
      where: { barcode },
      relations: ['canonicalProduct'],
    });

    if (productBarcode?.canonicalProduct) {
      // Verify the product belongs to the same organization
      if (productBarcode.canonicalProduct.organizationId === organizationId) {
        return productBarcode.canonicalProduct;
      }
    }

    return null;
  }

  /**
   * Update account's last poll time
   */
  async updateLastPollTime(accountId: string, pollTime: Date): Promise<void> {
    const account = await this.accountRepo.findOne({ where: { id: accountId } });
    if (account) {
      account.settings = {
        ...account.settings,
        lastOrderPollTime: pollTime.toISOString(),
      };
      await this.accountRepo.save(account);
    }
  }

  /**
   * Check if order needs stock update
   */
  async orderNeedsStockUpdate(orderId: string): Promise<boolean> {
    const order = await this.orderRepo.findOne({ where: { id: orderId } });
    return order ? !order.stockUpdated : false;
  }

  /**
   * Get orders that need stock update (for recovery)
   */
  async getOrdersNeedingStockUpdate(limit = 100): Promise<Order[]> {
    return this.orderRepo.find({
      where: { stockUpdated: false },
      order: { createdAt: 'ASC' },
      take: limit,
    });
  }
}
