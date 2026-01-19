import {
  IsString,
  IsUUID,
  IsOptional,
  IsArray,
  IsEnum,
  IsBoolean,
  IsNumber,
  Min,
  Max,
} from 'class-validator';

export enum SyncType {
  FULL = 'full',
  PRODUCTS = 'products',
  PRICES = 'prices',
  STOCKS = 'stocks',
}

export enum SyncDirection {
  INBOUND = 'inbound',
  OUTBOUND = 'outbound',
  BOTH = 'both',
}

export class StartSyncDto {
  @IsUUID()
  organizationId: string;

  @IsEnum(SyncType)
  type: SyncType;

  @IsEnum(SyncDirection)
  @IsOptional()
  direction?: SyncDirection = SyncDirection.BOTH;

  @IsUUID()
  @IsOptional()
  marketplaceAccountId?: string;

  @IsArray()
  @IsUUID('4', { each: true })
  @IsOptional()
  productIds?: string[];

  @IsBoolean()
  @IsOptional()
  force?: boolean = false;
}

export class SyncProductsDto {
  @IsUUID()
  organizationId: string;

  @IsArray()
  @IsUUID('4', { each: true })
  @IsOptional()
  productIds?: string[];

  @IsBoolean()
  @IsOptional()
  includeOutbound?: boolean = true;
}

export class SyncPricesDto {
  @IsUUID()
  organizationId: string;

  @IsArray()
  @IsUUID('4', { each: true })
  @IsOptional()
  productIds?: string[];
}

export class SyncStocksDto {
  @IsUUID()
  organizationId: string;

  @IsArray()
  @IsUUID('4', { each: true })
  @IsOptional()
  productIds?: string[];

  @IsUUID()
  @IsOptional()
  warehouseId?: string;
}

export class GetSyncJobsDto {
  @IsUUID()
  organizationId: string;

  @IsNumber()
  @Min(1)
  @Max(100)
  @IsOptional()
  limit?: number = 20;

  @IsString()
  @IsOptional()
  status?: string;

  @IsString()
  @IsOptional()
  jobType?: string;
}

export class SyncJobResponseDto {
  id: string;
  organizationId: string;
  marketplaceAccountId: string | null;
  jobType: string;
  direction: string;
  status: string;
  totalItems: number;
  processedItems: number;
  successItems: number;
  failedItems: number;
  progress: number;
  startedAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
  errors?: Array<{ itemId?: string; message: string }>;
}

export class QueueStatusDto {
  name: string;
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
  paused: boolean;
}

export class SyncStatusResponseDto {
  isRunning: boolean;
  activeJobs: number;
  queues: QueueStatusDto[];
  lastSync: {
    products?: Date;
    prices?: Date;
    stocks?: Date;
  };
}
