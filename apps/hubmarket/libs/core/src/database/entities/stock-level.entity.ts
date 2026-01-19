import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  UpdateDateColumn,
  Index,
  Unique,
} from 'typeorm';

@Entity('stock_levels')
@Unique(['canonicalProductId', 'warehouseId'])
export class StockLevel {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  @Index()
  canonicalProductId: string;

  @Column('uuid')
  @Index()
  warehouseId: string;

  @Column({ type: 'int', default: 0 })
  available: number;

  @Column({ type: 'int', default: 0 })
  reserved: number;

  @Column({ type: 'int', default: 0 })
  safetyBuffer: number;

  @UpdateDateColumn({ type: 'timestamp with time zone' })
  updatedAt: Date;
}
