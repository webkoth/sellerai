import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { CanonicalProduct } from './canonical-product.entity';

@Entity('product_barcodes')
export class ProductBarcode {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  @Index()
  canonicalProductId: string;

  @Column({ type: 'varchar', length: 50 })
  @Index({ unique: true })
  barcode: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  sizeCode: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  techSize: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  wmsId: string | null;

  @ManyToOne(() => CanonicalProduct, (product) => product.barcodes, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'canonicalProductId' })
  canonicalProduct: CanonicalProduct;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  createdAt: Date;
}
