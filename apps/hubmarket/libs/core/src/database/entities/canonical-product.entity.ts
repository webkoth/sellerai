import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  OneToMany,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { ProductMarketplaceMapping } from './product-marketplace-mapping.entity';
import { CategoryMapping } from './category-mapping.entity';
import { ProductBarcode } from './product-barcode.entity';

export interface ProductAttributes {
  color?: string;
  size?: string;
  weight?: number;
  dimensions?: {
    length: number;
    width: number;
    height: number;
  };
  country?: string;
  manufacturer?: string;
  vatRate?: number;
  [key: string]: unknown;
}

export interface ProductSize {
  sizeCode: string;
  techSize: string;
  barcode: string;
  wmsId?: string;
  price?: number;
  stock?: number;
}

export type ProductStatus = 'draft' | 'active' | 'archived';

@Entity('canonical_products')
@Index(['organizationId', 'internalSku'], { unique: true })
export class CanonicalProduct {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  @Index()
  organizationId: string;

  @Column({ length: 255 })
  @Index()
  internalSku: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  @Index()
  barcode: string | null;

  @Column({ length: 500 })
  name: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  brand: string | null;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  categoryId: string | null;

  @Column({ type: 'uuid', nullable: true })
  @Index()
  categoryMappingId: string | null;

  @ManyToOne(() => CategoryMapping, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'categoryMappingId' })
  categoryMapping: CategoryMapping | null;

  @Column({ type: 'jsonb', default: {} })
  attributes: ProductAttributes;

  @Column({ type: 'jsonb', default: [] })
  images: string[];

  @Column({ type: 'jsonb', default: [] })
  sizes: ProductSize[];

  @Column({ type: 'decimal', precision: 15, scale: 2, nullable: true })
  basePrice: number | null;

  @Column({ type: 'decimal', precision: 15, scale: 2, nullable: true })
  minPrice: number | null;

  @Column({ length: 3, default: 'RUB' })
  currency: string;

  @Column({ type: 'int', default: 0 })
  totalStock: number;

  @Column({ length: 50, default: 'active' })
  @Index()
  status: ProductStatus;

  @OneToMany(() => ProductMarketplaceMapping, (mapping) => mapping.canonicalProduct)
  mappings: ProductMarketplaceMapping[];

  @OneToMany(() => ProductBarcode, (barcode) => barcode.canonicalProduct)
  barcodes: ProductBarcode[];

  @CreateDateColumn({ type: 'timestamp with time zone' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp with time zone' })
  updatedAt: Date;
}
