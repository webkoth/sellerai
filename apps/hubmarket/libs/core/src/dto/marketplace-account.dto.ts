import { IsString, IsBoolean, IsOptional, IsObject, IsEnum } from 'class-validator';
import { MarketplaceType } from '../interfaces/marketplace.types';
import {
  MarketplaceCredentials,
  MarketplaceSettings,
} from '../database/entities/marketplace-account.entity';

export class CreateMarketplaceAccountDto {
  @IsString()
  organizationId: string;

  @IsEnum(['wildberries', 'ozon', 'yandex_market'])
  marketplace: MarketplaceType;

  @IsString()
  name: string;

  @IsBoolean()
  @IsOptional()
  isMaster?: boolean;

  @IsObject()
  credentials: MarketplaceCredentials;

  @IsObject()
  @IsOptional()
  settings?: MarketplaceSettings;
}

export class UpdateMarketplaceAccountDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @IsObject()
  @IsOptional()
  credentials?: MarketplaceCredentials;

  @IsObject()
  @IsOptional()
  settings?: MarketplaceSettings;
}
