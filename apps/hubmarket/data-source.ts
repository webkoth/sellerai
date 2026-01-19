import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

// Import all entities
import {
  MarketplaceAccount,
  CanonicalProduct,
  ProductMarketplaceMapping,
  ProductBarcode,
  StockLevel,
  StockSyncEvent,
  Order,
  SyncJob,
  CategoryMapping,
  AttributeMapping,
  DictionaryValueCache,
} from './libs/core/src';

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  username: process.env.DB_USERNAME || 'admin',
  password: process.env.DB_PASSWORD || 'admin',
  database: process.env.DB_DATABASE || 'hubmarket',
  entities: [
    MarketplaceAccount,
    CanonicalProduct,
    ProductMarketplaceMapping,
    ProductBarcode,
    StockLevel,
    StockSyncEvent,
    Order,
    SyncJob,
    CategoryMapping,
    AttributeMapping,
    DictionaryValueCache,
  ],
  migrations: ['./migrations/*.ts'],
  synchronize: false,
  logging: true,
});
