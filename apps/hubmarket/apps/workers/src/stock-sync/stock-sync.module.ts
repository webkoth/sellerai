import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { TypeOrmModule } from '@nestjs/typeorm';
import { QUEUE_NAMES } from '@hubmarket/queues';
import {
  CanonicalProduct,
  ProductMarketplaceMapping,
  MarketplaceAccount,
  StockLevel,
  StockSyncEvent,
  Order,
  CategoryMapping,
  AttributeMapping,
} from '@hubmarket/core';
import { StockSyncWorker } from './stock-sync.worker';
import { StockSyncService } from './stock-sync.service';
import { IdempotencyModule } from '../shared/idempotency/idempotency.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      CanonicalProduct,
      ProductMarketplaceMapping,
      MarketplaceAccount,
      StockLevel,
      StockSyncEvent,
      Order,
      CategoryMapping,
      AttributeMapping,
    ]),
    BullModule.registerQueue(
      { name: QUEUE_NAMES.ORDERS_STOCK_UPDATE },
      { name: QUEUE_NAMES.MP_WILDBERRIES_STOCKS },
      { name: QUEUE_NAMES.MP_OZON },
      { name: QUEUE_NAMES.MP_YANDEX },
    ),
    IdempotencyModule,
  ],
  providers: [StockSyncWorker, StockSyncService],
  exports: [StockSyncService],
})
export class StockSyncModule {}
