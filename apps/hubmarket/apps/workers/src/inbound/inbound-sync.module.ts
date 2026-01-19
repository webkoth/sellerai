import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { TypeOrmModule } from '@nestjs/typeorm';
import { QUEUE_NAMES } from '@hubmarket/queues';
import {
  CanonicalProduct,
  ProductMarketplaceMapping,
  ProductBarcode,
  MarketplaceAccount,
  SyncJob,
  CategoryMapping,
  AttributeMapping,
} from '@hubmarket/core';
import { InboundProductsWorker } from './inbound-products.worker';
import { InboundPricesWorker } from './inbound-prices.worker';
import { InboundSyncService } from './inbound-sync.service';
import { TransformersModule } from '../shared/transformers/transformers.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      CanonicalProduct,
      ProductMarketplaceMapping,
      ProductBarcode,
      MarketplaceAccount,
      SyncJob,
      CategoryMapping,
      AttributeMapping,
    ]),
    BullModule.registerQueue(
      { name: QUEUE_NAMES.SYNC_INBOUND_PRODUCTS },
      { name: QUEUE_NAMES.SYNC_INBOUND_PRICES },
    ),
    TransformersModule,
  ],
  providers: [InboundProductsWorker, InboundPricesWorker, InboundSyncService],
  exports: [InboundSyncService],
})
export class InboundSyncModule {}
