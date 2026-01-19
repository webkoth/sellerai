// Inbound sync jobs
export interface SyncInboundProductsJob {
  organizationId: string;
  marketplaceAccountId: string;
  syncJobId: string;
  pageToken?: string;
  limit?: number;
}

export interface SyncInboundPricesJob {
  organizationId: string;
  marketplaceAccountId: string;
  syncJobId: string;
  productIds?: string[];
}

export interface SyncInboundStocksJob {
  organizationId: string;
  marketplaceAccountId: string;
  syncJobId: string;
  warehouseIds?: string[];
}

// Outbound sync jobs
export interface SyncOutboundProductJob {
  canonicalProductId: string;
  marketplaceAccountId: string;
  syncJobId?: string;
  operation: 'create' | 'update' | 'archive';
  idempotencyKey: string;
}

export interface SyncOutboundPriceJob {
  canonicalProductId: string;
  marketplaceAccountId: string;
  newPrice?: number;
  oldPrice?: number;
  idempotencyKey: string;
}

export interface SyncOutboundStockJob {
  canonicalProductId: string;
  marketplaceAccountId: string;
  warehouseId?: string;
  newStock: number;
  idempotencyKey: string;
}

// Stock update job (bidirectional)
export interface StockUpdateJob {
  canonicalProductId: string;
  newStock: number;
  delta?: number;
  reason: 'order' | 'manual' | 'sync';
  sourceMarketplaceAccountId?: string;
  sourceOrderId?: string;
  idempotencyKey: string;
}

// Order polling job
export interface OrderPollJob {
  organizationId: string;
  marketplaceAccountId: string;
  fromDate?: string;
}

// Marketplace API jobs (rate-limited)
export interface MarketplaceApiJob {
  accountId: string;
  operation: string;
  payload: unknown;
  idempotencyKey: string;
  retryCount?: number;
}

// Sync all stocks job
export interface SyncAllStocksJob {
  organizationId: string;
  marketplaceAccountId: string;
  syncJobId: string;
}
