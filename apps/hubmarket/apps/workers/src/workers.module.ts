import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { FailSafeModule } from '@hubmarket/core/modules/fail-safe.module';

// Workers
import { InboundSyncModule } from './inbound/inbound-sync.module';
import { OutboundSyncModule } from './outbound/outbound-sync.module';
import { StockSyncModule } from './stock-sync/stock-sync.module';
import { OrderPollModule } from './order-poll/order-poll.module';
import { MarketplaceJobsModule } from './marketplace-jobs/marketplace-jobs.module';

// Shared
import { TransformersModule } from './shared/transformers/transformers.module';
import { IdempotencyModule } from './shared/idempotency/idempotency.module';

// Configuration
import databaseConfig from './config/database.config';
import redisConfig from './config/redis.config';

@Module({
  imports: [
    // Configuration
    ConfigModule.forRoot({
      isGlobal: true,
      load: [databaseConfig, redisConfig],
      envFilePath: ['.env.local', '.env'],
    }),

    // Database
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get('database.host'),
        port: configService.get('database.port'),
        username: configService.get('database.username'),
        password: configService.get('database.password'),
        database: configService.get('database.database'),
        autoLoadEntities: true,
        synchronize: false,
        logging: configService.get('database.logging', false),
      }),
      inject: [ConfigService],
    }),

    // BullMQ
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        connection: {
          host: configService.get('redis.host'),
          port: configService.get('redis.port'),
          password: configService.get('redis.password'),
        },
        defaultJobOptions: {
          removeOnComplete: 1000,
          removeOnFail: 5000,
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 5000,
          },
        },
      }),
      inject: [ConfigService],
    }),

    // Core modules
    FailSafeModule,

    // Shared modules
    TransformersModule,
    IdempotencyModule,

    // Worker modules
    InboundSyncModule,
    OutboundSyncModule,
    StockSyncModule,
    OrderPollModule,
    MarketplaceJobsModule,
  ],
})
export class WorkersModule {}
