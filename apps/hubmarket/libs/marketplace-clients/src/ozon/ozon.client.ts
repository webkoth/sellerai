import { AxiosError } from 'axios';
import { BaseMarketplaceClient } from '../base/base-client';
import {
  MarketplaceError,
  MarketplaceErrorType,
  OzonApiError,
} from '../base/errors';

export interface OzonCredentials {
  clientId: string;
  apiKey: string;
}

// Types based on docs/api/ozon/products.md and prices-stocks.md
export interface OzonProduct {
  id: number;
  offer_id: string;
  name: string;
  barcode?: string;
  price: string;
  old_price?: string;
  archived?: boolean;
  is_fbo_visible?: boolean;
  is_fbs_visible?: boolean;
  stocks?: {
    coming: number;
    present: number;
    reserved: number;
  };
  attributes?: Array<{
    attribute_id: number;
    complex_id?: number;
    values?: Array<{ value: string }>;
  }>;
  images?: string[];
}

export interface OzonProductsListResponse {
  result: {
    items: OzonProduct[];
    total: number;
    last_id: string;
  };
}

export interface OzonPriceUpdate {
  offer_id?: string;
  product_id?: number;
  price: string;
  old_price?: string;
  min_price?: string;
}

export interface OzonStockUpdate {
  offer_id?: string;
  product_id?: number;
  stock: number;
}

export interface OzonStockFBSUpdate {
  offer_id?: string;
  product_id?: number;
  warehouse_id: number;
  stock: number;
}

export interface OzonWarehouse {
  warehouse_id: number;
  name: string;
  is_rfbs?: boolean;
}

const OZON_BASE_URL = 'https://api-seller.ozon.ru';
const OZON_RATE_LIMIT = { maxRequests: 300, windowMs: 60000 };

export class OzonClient extends BaseMarketplaceClient {
  protected readonly marketplace = 'ozon';

  constructor(credentials: OzonCredentials) {
    super({
      baseURL: OZON_BASE_URL,
      headers: {
        'Client-Id': credentials.clientId,
        'Api-Key': credentials.apiKey,
      },
      rateLimitConfig: OZON_RATE_LIMIT,
    });
  }

  // === Products ===

  async getProductsList(params?: {
    filter?: {
      offer_id?: string[];
      product_id?: number[];
      visibility?: string;
    };
    last_id?: string;
    limit?: number;
  }): Promise<OzonProductsListResponse> {
    return this.request({
      method: 'POST',
      url: '/v3/product/list',
      data: {
        filter: params?.filter || {},
        last_id: params?.last_id || '',
        limit: params?.limit || 100,
      },
    });
  }

  async getProductsInfo(params: {
    offer_id?: string[];
    product_id?: number[];
    sku?: number[];
  }): Promise<{ result: { items: OzonProduct[] } }> {
    return this.request({
      method: 'POST',
      url: '/v2/product/info',
      data: params,
    });
  }

  async importProducts(
    items: Array<{
      offer_id: string;
      name: string;
      barcode?: string;
      price: string;
      old_price?: string;
      vat?: string;
      images?: string[];
      attributes?: Array<{
        complex_id?: number;
        id: number;
        values: Array<{ value: string }>;
      }>;
    }>,
  ): Promise<{ result: { task_id: number } }> {
    return this.request({
      method: 'POST',
      url: '/v3/product/import',
      data: { items },
    });
  }

  async getImportStatus(taskId: number): Promise<{
    result: {
      items: Array<{
        offer_id: string;
        product_id?: number;
        status: string;
        errors?: Array<{ code: string; message: string }>;
      }>;
    };
  }> {
    return this.request({
      method: 'POST',
      url: '/v1/product/import/info',
      data: { task_id: taskId },
    });
  }

  async archiveProducts(productIds: number[]): Promise<{ result: boolean }> {
    return this.request({
      method: 'POST',
      url: '/v1/product/archive',
      data: { product_id: productIds },
    });
  }

  // === Prices ===

  async updatePrices(
    prices: OzonPriceUpdate[],
  ): Promise<{ result: Array<{ offer_id: string; updated: boolean; errors?: unknown[] }> }> {
    return this.request({
      method: 'POST',
      url: '/v1/product/import/prices',
      data: { prices },
    });
  }

  async getPricesInfo(params?: {
    filter?: {
      offer_id?: string[];
      product_id?: number[];
      visibility?: string;
    };
    last_id?: string;
    limit?: number;
  }): Promise<{
    result: {
      items: Array<{
        offer_id: string;
        product_id: number;
        price: { price: string; old_price?: string; min_price?: string };
      }>;
      last_id: string;
      total: number;
    };
  }> {
    return this.request({
      method: 'POST',
      url: '/v5/product/info/prices',
      data: {
        filter: params?.filter || {},
        last_id: params?.last_id || '',
        limit: params?.limit || 100,
      },
    });
  }

  // === Stocks ===

  async updateStocksFBO(
    stocks: OzonStockUpdate[],
  ): Promise<{ result: Array<{ offer_id: string; updated: boolean; errors?: unknown[] }> }> {
    return this.request({
      method: 'POST',
      url: '/v1/product/import/stocks',
      data: { stocks },
    });
  }

  async updateStocksFBS(
    stocks: OzonStockFBSUpdate[],
  ): Promise<{ result: Array<{ offer_id: string; warehouse_id: number; updated: boolean; errors?: unknown[] }> }> {
    return this.request({
      method: 'POST',
      url: '/v2/products/stocks',
      data: { stocks },
    });
  }

  async getStocksInfo(params?: {
    filter?: {
      offer_id?: string[];
      product_id?: number[];
      visibility?: string;
    };
    last_id?: string;
    limit?: number;
  }): Promise<{
    result: {
      items: Array<{
        offer_id: string;
        product_id: number;
        stocks: Array<{
          warehouse_name: string;
          present: number;
          reserved: number;
        }>;
      }>;
      last_id: string;
      total: number;
    };
  }> {
    return this.request({
      method: 'POST',
      url: '/v4/product/info/stocks',
      data: {
        filter: params?.filter || {},
        last_id: params?.last_id || '',
        limit: params?.limit || 100,
      },
    });
  }

  // === Warehouses ===

  async getWarehouses(): Promise<{ result: OzonWarehouse[] }> {
    return this.request({
      method: 'POST',
      url: '/v1/warehouse/list',
      data: {},
    });
  }

  // === Orders (FBS) ===

  async getOrdersFBS(params?: {
    dir?: 'ASC' | 'DESC';
    filter?: {
      since?: string;
      to?: string;
      status?: string;
    };
    limit?: number;
    offset?: number;
    with?: {
      analytics_data?: boolean;
      barcodes?: boolean;
      financial_data?: boolean;
    };
  }): Promise<{
    result: {
      postings: Array<{
        posting_number: string;
        order_id: number;
        order_number: string;
        status: string;
        products: Array<{
          sku: number;
          name: string;
          quantity: number;
          offer_id: string;
          price: string;
        }>;
        in_process_at?: string;
        shipment_date?: string;
      }>;
      has_next: boolean;
    };
  }> {
    return this.request({
      method: 'POST',
      url: '/v3/posting/fbs/list',
      data: {
        dir: params?.dir || 'DESC',
        filter: params?.filter || {},
        limit: params?.limit || 100,
        offset: params?.offset || 0,
        with: params?.with || {},
      },
    });
  }

  protected normalizeError(error: AxiosError): MarketplaceError {
    const data = error.response?.data as {
      code?: number;
      message?: string;
      details?: unknown[];
    } | undefined;
    const message = data?.message || error.message;
    const errorType = error.response?.status
      ? this.classifyHttpError(error.response.status)
      : MarketplaceErrorType.NETWORK_ERROR;

    return new OzonApiError(message, errorType, data?.code, data?.details);
  }
}
