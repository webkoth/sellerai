import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import {
  CategoryMapping,
  AttributeMapping,
  DictionaryValueCache,
  CanonicalProduct,
  ProductBarcode,
  MarketplaceAccount,
  ProductMarketplaceMapping,
} from '@hubmarket/core';
import { CategoriesCommand } from './commands/categories.command';
import { SyncCommand } from './commands/sync.command';
import { CategoryMappingService } from './services/category-mapping.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get('DB_HOST', 'localhost'),
        port: configService.get('DB_PORT', 5432),
        username: configService.get('DB_USERNAME', 'postgres'),
        password: configService.get('DB_PASSWORD', 'postgres'),
        database: configService.get('DB_DATABASE', 'hubmarket'),
        entities: [
          CategoryMapping,
          AttributeMapping,
          DictionaryValueCache,
          CanonicalProduct,
          ProductBarcode,
          MarketplaceAccount,
          ProductMarketplaceMapping,
        ],
        synchronize: false,
      }),
    }),
    TypeOrmModule.forFeature([
      CategoryMapping,
      AttributeMapping,
      DictionaryValueCache,
      CanonicalProduct,
      ProductBarcode,
      MarketplaceAccount,
      ProductMarketplaceMapping,
    ]),
  ],
  providers: [
    CategoriesCommand,
    SyncCommand,
    CategoryMappingService,
  ],
})
export class CliModule {}
