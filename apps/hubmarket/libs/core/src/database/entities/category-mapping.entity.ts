import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  OneToMany,
} from 'typeorm';
import { AttributeMapping } from './attribute-mapping.entity';

@Entity('category_mappings')
@Index(['organizationId', 'canonicalCategory'], { unique: true })
export class CategoryMapping {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  @Index()
  organizationId: string;

  @Column({ length: 255 })
  canonicalCategory: string;

  // Wildberries category mapping
  @Column({ type: 'int', nullable: true })
  @Index()
  wbSubjectId: number | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  wbSubjectName: string | null;

  // Ozon category mapping
  @Column({ type: 'bigint', nullable: true })
  @Index()
  ozonCategoryId: string | null; // bigint stored as string in TypeORM

  @Column({ type: 'int', nullable: true })
  ozonTypeId: number | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  ozonCategoryName: string | null;

  // Yandex Market category mapping
  @Column({ type: 'bigint', nullable: true })
  @Index()
  yandexCategoryId: string | null; // bigint stored as string in TypeORM

  @Column({ type: 'varchar', length: 255, nullable: true })
  yandexCategoryName: string | null;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @OneToMany(() => AttributeMapping, (attr) => attr.categoryMapping)
  attributeMappings: AttributeMapping[];

  @CreateDateColumn({ type: 'timestamp with time zone' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp with time zone' })
  updatedAt: Date;
}
