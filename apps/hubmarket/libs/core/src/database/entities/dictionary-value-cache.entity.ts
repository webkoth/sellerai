import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { MarketplaceType } from '../../interfaces/marketplace.types';

@Entity('dictionary_values_cache')
@Index(['marketplace', 'attributeId', 'valueId'], { unique: true })
export class DictionaryValueCache {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 50 })
  @Index()
  marketplace: MarketplaceType;

  @Column({ type: 'int' })
  @Index()
  attributeId: number;

  @Column({ type: 'bigint' })
  valueId: string; // bigint stored as string in TypeORM

  @Column({ length: 500 })
  @Index()
  valueText: string;

  @Column({ type: 'bigint', nullable: true })
  parentValueId: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  info: string | null;

  @UpdateDateColumn({ type: 'timestamp with time zone' })
  updatedAt: Date;
}
