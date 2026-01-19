import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
  Unique,
} from 'typeorm';
import { CanonicalProduct } from './canonical-product.entity';
import { MarketplaceAccount } from './marketplace-account.entity';

export type SyncStatus = 'pending' | 'synced' | 'error' | 'not_found';

@Entity('product_marketplace_mappings')
@Unique(['canonicalProductId', 'marketplaceAccountId'])
@Index(['externalId'])
@Index(['externalSku'])
export class ProductMarketplaceMapping {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  @Index()
  canonicalProductId: string;

  @Column('uuid')
  @Index()
  marketplaceAccountId: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  externalId: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  externalSku: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  marketplaceUrl: string | null;

  @Column({ type: 'jsonb', default: {} })
  marketplaceData: Record<string, unknown>;

  @Column({ length: 50, default: 'pending' })
  @Index()
  syncStatus: SyncStatus;

  @Column({ type: 'timestamp with time zone', nullable: true })
  lastSyncAt: Date | null;

  @Column({ type: 'text', nullable: true })
  lastError: string | null;

  @Column({ type: 'decimal', precision: 15, scale: 2, nullable: true })
  currentPrice: number | null;

  @Column({ type: 'decimal', precision: 15, scale: 2, nullable: true })
  oldPrice: number | null;

  @Column({ type: 'int', default: 0 })
  currentStock: number;

  @ManyToOne(() => CanonicalProduct, (product) => product.mappings)
  @JoinColumn({ name: 'canonicalProductId' })
  canonicalProduct: CanonicalProduct;

  @ManyToOne(() => MarketplaceAccount)
  @JoinColumn({ name: 'marketplaceAccountId' })
  marketplaceAccount: MarketplaceAccount;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp with time zone' })
  updatedAt: Date;
}
