import {
  IsString,
  IsNumber,
  IsOptional,
  IsObject,
  IsArray,
  IsEnum,
} from 'class-validator';
import {
  ProductAttributes,
  ProductStatus,
} from '../database/entities/canonical-product.entity';

export class CreateCanonicalProductDto {
  @IsString()
  organizationId: string;

  @IsString()
  internalSku: string;

  @IsString()
  @IsOptional()
  barcode?: string;

  @IsString()
  name: string;

  @IsString()
  @IsOptional()
  brand?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  categoryId?: string;

  @IsObject()
  @IsOptional()
  attributes?: ProductAttributes;

  @IsArray()
  @IsOptional()
  images?: string[];

  @IsNumber()
  @IsOptional()
  basePrice?: number;

  @IsNumber()
  @IsOptional()
  minPrice?: number;

  @IsNumber()
  @IsOptional()
  totalStock?: number;
}

export class UpdateCanonicalProductDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  brand?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsObject()
  @IsOptional()
  attributes?: ProductAttributes;

  @IsArray()
  @IsOptional()
  images?: string[];

  @IsNumber()
  @IsOptional()
  basePrice?: number;

  @IsNumber()
  @IsOptional()
  minPrice?: number;

  @IsNumber()
  @IsOptional()
  totalStock?: number;

  @IsEnum(['draft', 'active', 'archived'])
  @IsOptional()
  status?: ProductStatus;
}
