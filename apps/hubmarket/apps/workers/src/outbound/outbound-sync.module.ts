import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { TypeOrmModule } from '@nestjs/typeorm';
import { QUEUE_NAMES } from '@hubmarket/queues';
import {
  CanonicalProduct,
  ProductMarketplaceMapping,
  MarketplaceAccount,
  SyncJob,
  CategoryMapping,
  AttributeMapping,
} from '@hubmarket/core';
import { OutboundPricesWorker } from './outbound-prices.worker';
import { OutboundProductsWorker } from './outbound-products.worker';
import { OutboundSyncService } from './outbound-sync.service';
import { TransformersModule } from '../shared/transformers/transformers.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      CanonicalProduct,
      ProductMarketplaceMapping,
      MarketplaceAccount,
      SyncJob,
      CategoryMapping,
      AttributeMapping,
    ]),
    BullModule.registerQueue(
      { name: QUEUE_NAMES.SYNC_OUTBOUND_PRODUCTS },
      { name: QUEUE_NAMES.SYNC_OUTBOUND_PRICES },
    ),
    TransformersModule,
  ],
  providers: [OutboundPricesWorker, OutboundProductsWorker, OutboundSyncService],
  exports: [OutboundSyncService],
})
export class OutboundSyncModule {}
