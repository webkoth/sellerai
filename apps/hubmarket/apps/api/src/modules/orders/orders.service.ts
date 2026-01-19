import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Order } from '@hubmarket/core';
import { StocksService } from '../stocks/stocks.service';

interface FindAllParams {
  page: number;
  limit: number;
  marketplaceAccountId?: string;
}

interface OrderItem {
  sku: string;
  quantity: number;
  canonicalProductId?: string;
}

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    private readonly stocksService: StocksService,
  ) {}

  async findAll(params: FindAllParams) {
    const { page, limit, marketplaceAccountId } = params;
    const skip = (page - 1) * limit;

    const queryBuilder = this.orderRepository.createQueryBuilder('order');

    if (marketplaceAccountId) {
      queryBuilder.where('order.marketplaceAccountId = :marketplaceAccountId', {
        marketplaceAccountId,
      });
    }

    const [items, total] = await queryBuilder
      .orderBy('order.createdAt', 'DESC')
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

  async processNewOrder(
    marketplaceAccountId: string,
    externalOrderId: string,
    items: OrderItem[],
    organizationId: string,
  ): Promise<Order> {
    // Check if order already exists (idempotency)
    const existingOrder = await this.orderRepository.findOne({
      where: { marketplaceAccountId, externalOrderId },
    });

    if (existingOrder) {
      this.logger.log(
        `Order ${externalOrderId} already exists, skipping stock update`,
      );
      return existingOrder;
    }

    // Create order record
    const order = this.orderRepository.create({
      organizationId,
      marketplaceAccountId,
      externalOrderId,
      status: 'new',
      items,
      stockUpdated: false,
    });

    const savedOrder = await this.orderRepository.save(order);

    // Update stocks for each item (bidirectional sync)
    for (const item of items) {
      if (item.canonicalProductId) {
        await this.stocksService.updateCanonicalStock(
          item.canonicalProductId,
          -item.quantity,
        );

        // Trigger stock sync to all marketplaces
        const product = await this.stocksService.getProductStocks(
          item.canonicalProductId,
        );
        await this.stocksService.triggerStockSync(
          item.canonicalProductId,
          product.canonical.totalStock || 0,
          'order',
          marketplaceAccountId,
          savedOrder.id,
        );
      }
    }

    // Mark order as stock-updated
    savedOrder.stockUpdated = true;
    await this.orderRepository.save(savedOrder);

    this.logger.log(
      `Processed order ${externalOrderId}, updated stocks for ${items.length} items`,
    );

    return savedOrder;
  }
}
