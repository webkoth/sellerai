import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { QUEUE_NAMES } from '@hubmarket/queues';
import {
  CanonicalProduct,
  ProductMarketplaceMapping,
  ProductBarcode,
  MarketplaceAccount,
  Order,
  CategoryMapping,
  AttributeMapping,
} from '@hubmarket/core';
import { OrderPollWorker } from './order-poll.worker';
import { OrderPollScheduler } from './order-poll.scheduler';
import { OrderPollService } from './order-poll.service';
import { StockSyncModule } from '../stock-sync/stock-sync.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    TypeOrmModule.forFeature([
      CanonicalProduct,
      ProductMarketplaceMapping,
      ProductBarcode,
      MarketplaceAccount,
      Order,
      CategoryMapping,
      AttributeMapping,
    ]),
    BullModule.registerQueue({ name: QUEUE_NAMES.ORDER_POLL }),
    StockSyncModule,
  ],
  providers: [OrderPollWorker, OrderPollScheduler, OrderPollService],
  exports: [OrderPollService],
})
export class OrderPollModule {}
