import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { TypeOrmModule } from '@nestjs/typeorm';
import { QUEUE_NAMES } from '@hubmarket/queues';
import {
  CanonicalProduct,
  ProductMarketplaceMapping,
  MarketplaceAccount,
  CategoryMapping,
  AttributeMapping,
} from '@hubmarket/core';
import { WildberriesJobProcessor } from './wildberries-job.processor';
import { OzonJobProcessor } from './ozon-job.processor';
import { YandexJobProcessor } from './yandex-job.processor';
import { MarketplaceJobService } from './marketplace-job.service';
import { TransformersModule } from '../shared/transformers/transformers.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      CanonicalProduct,
      ProductMarketplaceMapping,
      MarketplaceAccount,
      CategoryMapping,
      AttributeMapping,
    ]),
    BullModule.registerQueue(
      {
        name: QUEUE_NAMES.MP_WILDBERRIES_STOCKS,
        defaultJobOptions: {
          attempts: 5,
          backoff: { type: 'exponential', delay: 5000 },
          removeOnComplete: 100,
          removeOnFail: 1000,
        },
      },
      {
        name: QUEUE_NAMES.MP_OZON,
        defaultJobOptions: {
          attempts: 5,
          backoff: { type: 'exponential', delay: 5000 },
          removeOnComplete: 100,
          removeOnFail: 1000,
        },
      },
      {
        name: QUEUE_NAMES.MP_YANDEX,
        defaultJobOptions: {
          attempts: 5,
          backoff: { type: 'exponential', delay: 5000 },
          removeOnComplete: 100,
          removeOnFail: 1000,
        },
      },
    ),
    TransformersModule,
  ],
  providers: [
    WildberriesJobProcessor,
    OzonJobProcessor,
    YandexJobProcessor,
    MarketplaceJobService,
  ],
  exports: [MarketplaceJobService],
})
export class MarketplaceJobsModule {}
