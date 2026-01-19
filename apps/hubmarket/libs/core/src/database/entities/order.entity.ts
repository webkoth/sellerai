import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  Unique,
} from 'typeorm';

export interface OrderItem {
  sku: string;
  quantity: number;
  price?: number;
  canonicalProductId?: string;
}

@Entity('orders')
@Unique(['marketplaceAccountId', 'externalOrderId'])
export class Order {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  @Index()
  organizationId: string;

  @Column('uuid')
  @Index()
  marketplaceAccountId: string;

  @Column({ length: 255 })
  @Index()
  externalOrderId: string;

  @Column({ length: 50 })
  status: string;

  @Column({ type: 'jsonb', default: [] })
  items: OrderItem[];

  @Column({ default: false })
  stockUpdated: boolean;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp with time zone' })
  updatedAt: Date;
}
