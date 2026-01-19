import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { SyncController } from './sync.controller';
import { SyncService } from './sync.service';
import { SyncOrchestrator } from './sync.orchestrator';
import { SyncJob } from '@hubmarket/core';
import { QUEUE_NAMES } from '@hubmarket/queues';
import { AccountsModule } from '../accounts/accounts.module';
import { ProductsModule } from '../products/products.module';
import { StocksModule } from '../stocks/stocks.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([SyncJob]),
    BullModule.registerQueue(
      { name: QUEUE_NAMES.SYNC_INBOUND_PRODUCTS },
      { name: QUEUE_NAMES.SYNC_INBOUND_PRICES },
      { name: QUEUE_NAMES.SYNC_OUTBOUND_PRODUCTS },
      { name: QUEUE_NAMES.SYNC_OUTBOUND_PRICES },
      { name: QUEUE_NAMES.ORDERS_STOCK_UPDATE },
      { name: QUEUE_NAMES.ORDER_POLL },
    ),
    AccountsModule,
    ProductsModule,
    StocksModule,
  ],
  controllers: [SyncController],
  providers: [SyncService, SyncOrchestrator],
  exports: [SyncService, SyncOrchestrator],
})
export class SyncModule {}
