import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { CategoryMapping } from './category-mapping.entity';

export type AttributeValueType = 'string' | 'number' | 'boolean' | 'dictionary' | 'array';

@Entity('attribute_mappings')
@Index(['categoryMappingId', 'canonicalName'], { unique: true })
export class AttributeMapping {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  @Index()
  categoryMappingId: string;

  @ManyToOne(() => CategoryMapping, (cat) => cat.attributeMappings, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'categoryMappingId' })
  categoryMapping: CategoryMapping;

  @Column({ length: 100 })
  @Index()
  canonicalName: string;

  // Wildberries attribute mapping
  @Column({ type: 'varchar', length: 255, nullable: true })
  wbCharacteristicName: string | null;

  @Column({ type: 'int', nullable: true })
  wbCharacteristicId: number | null;

  // Ozon attribute mapping
  @Column({ type: 'int', nullable: true })
  @Index()
  ozonAttributeId: number | null;

  @Column({ type: 'boolean', default: false })
  ozonIsDictionary: boolean;

  // Yandex Market attribute mapping
  @Column({ type: 'bigint', nullable: true })
  yandexParameterId: string | null; // bigint stored as string in TypeORM

  @Column({ type: 'varchar', length: 255, nullable: true })
  yandexParameterName: string | null;

  // Required flags per marketplace
  @Column({ type: 'boolean', default: false })
  isRequiredWb: boolean;

  @Column({ type: 'boolean', default: false })
  isRequiredOzon: boolean;

  @Column({ type: 'boolean', default: false })
  isRequiredYandex: boolean;

  @Column({ length: 50, default: 'string' })
  valueType: AttributeValueType;

  @Column({ type: 'varchar', length: 500, nullable: true })
  defaultValue: string | null;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp with time zone' })
  updatedAt: Date;
}
