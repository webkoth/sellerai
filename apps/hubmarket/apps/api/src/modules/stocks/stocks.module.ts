import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { StocksController } from './stocks.controller';
import { StocksService } from './stocks.service';
import {
  CanonicalProduct,
  ProductMarketplaceMapping,
  StockLevel,
  StockSyncEvent,
} from '@hubmarket/core';
import { QUEUE_NAMES } from '@hubmarket/queues';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      CanonicalProduct,
      ProductMarketplaceMapping,
      StockLevel,
      StockSyncEvent,
    ]),
    BullModule.registerQueue({
      name: QUEUE_NAMES.ORDERS_STOCK_UPDATE,
    }),
  ],
  controllers: [StocksController],
  providers: [StocksService],
  exports: [StocksService],
})
export class StocksModule {}
