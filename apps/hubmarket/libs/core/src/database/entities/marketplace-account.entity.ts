import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { MarketplaceType } from '../../interfaces/marketplace.types';

export interface MarketplaceCredentials {
  // Wildberries
  token?: string;
  // Ozon
  clientId?: string;
  apiKey?: string;
  // Yandex Market
  businessId?: string;
  campaignId?: string;
  oauthToken?: string;  // Alternative auth for Yandex
  // Allow index access for flexibility
  [key: string]: string | undefined;
}

export interface MarketplaceSettings {
  syncProducts?: boolean;
  syncPrices?: boolean;
  syncStocks?: boolean;
  warehouseMappings?: Record<string, string>;
  lastOrderPollTime?: string;  // ISO date string of last order poll
}

@Entity('marketplace_accounts')
@Index(['organizationId', 'marketplace'])
export class MarketplaceAccount {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  @Index()
  organizationId: string;

  @Column({
    type: 'varchar',
    length: 50,
  })
  marketplace: MarketplaceType;

  @Column({ length: 255 })
  name: string;

  @Column({ default: false })
  isMaster: boolean;

  @Column({ default: true })
  isActive: boolean;

  @Column({ type: 'jsonb' })
  credentials: MarketplaceCredentials;

  @Column({ type: 'jsonb', default: {} })
  settings: MarketplaceSettings;

  @Column({ type: 'timestamp with time zone', nullable: true })
  lastSyncAt: Date | null;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp with time zone' })
  updatedAt: Date;
}
