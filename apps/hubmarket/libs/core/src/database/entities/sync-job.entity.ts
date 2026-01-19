import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

export type SyncJobType = 'products' | 'prices' | 'stocks' | 'full';
export type SyncDirection = 'inbound' | 'outbound';
export type SyncJobStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface SyncError {
  itemId?: string;
  sku?: string;
  message?: string;
  error?: string;  // Alias for message
  timestamp?: Date;
}

@Entity('sync_jobs')
export class SyncJob {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  @Index()
  organizationId: string;

  @Column('uuid', { nullable: true })
  @Index()
  marketplaceAccountId: string | null;

  @Column({ length: 50 })
  jobType: SyncJobType;

  @Column({ length: 20 })
  direction: SyncDirection;

  @Column({ length: 50, default: 'pending' })
  @Index()
  status: SyncJobStatus;

  @Column({ type: 'int', default: 0 })
  totalItems: number;

  @Column({ type: 'int', default: 0 })
  processedItems: number;

  @Column({ type: 'int', default: 0 })
  successItems: number;

  @Column({ type: 'int', default: 0 })
  failedItems: number;

  @Column({ type: 'jsonb', default: [] })
  errors: SyncError[];

  @Column({ type: 'timestamp with time zone', nullable: true })
  startedAt: Date | null;

  @Column({ type: 'timestamp with time zone', nullable: true })
  completedAt: Date | null;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  createdAt: Date;
}
