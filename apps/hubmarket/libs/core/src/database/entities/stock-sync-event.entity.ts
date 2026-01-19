import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

export interface SyncedToEntry {
  accountId: string;
  status: 'pending' | 'success' | 'failed';
  syncedAt?: Date;
  error?: string;
}

@Entity('stock_sync_events')
export class StockSyncEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  @Index()
  canonicalProductId: string;

  @Column('uuid', { nullable: true })
  @Index()
  sourceMarketplaceAccountId: string | null;

  @Column('uuid', { nullable: true })
  sourceOrderId: string | null;

  @Column({ type: 'int' })
  delta: number;

  @Column({ length: 50 })
  reason: string;

  @Column({ type: 'jsonb', default: [] })
  syncedTo: SyncedToEntry[];

  @CreateDateColumn({ type: 'timestamp with time zone' })
  createdAt: Date;
}
