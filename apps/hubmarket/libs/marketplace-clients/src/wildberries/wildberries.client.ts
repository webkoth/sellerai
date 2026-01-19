import { AxiosError } from 'axios';
import { BaseMarketplaceClient } from '../base/base-client';
import {
  MarketplaceError,
  MarketplaceErrorType,
  WildberriesApiError,
} from '../base/errors';

export interface WildberriesCredentials {
  token?: string;
  apiKey?: string;  // Alias for token
}

function getWildberriesToken(credentials: WildberriesCredentials): string {
  const token = credentials.token || credentials.apiKey;
  if (!token) {
    throw new Error('Wildberries token or apiKey is required');
  }
  return token;
}

// Types based on docs/api/wildberries/content.md
export interface WBProduct {
  nmID: number;
  imtID: number;
  vendorCode: string;
  title: string;
  brand: string;
  description?: string;
  photos?: Array<{ big: string; small?: string }>;
  sizes?: Array<{
    techSize: string;
    skus: string[];
    price: number;
    wmsId?: string;
  }>;
  colors?: string[];
}

export interface WBProductsListResponse {
  cursor: {
    nmID: number;
    total: number;
    limit: number;
    updatedAt?: string;
  };
  cards: WBProduct[];
}

export interface WBStockUpdate {
  sku: string;
  amount: number;
}

export interface WBPriceUpdate {
  nmID: number;
  price: number;
  discount?: number;
}

export interface WBWarehouse {
  id: number;
  name: string;
  officeId?: number;
}

const WB_BASE_URLS = {
  content: 'https://content-api.wildberries.ru',
  marketplace: 'https://marketplace-api.wildberries.ru',
  statistics: 'https://statistics-api.wildberries.ru',
  supplies: 'https://supplies-api.wildberries.ru',
};

const WB_RATE_LIMITS = {
  content: { maxRequests: 60, windowMs: 60000, burstSize: 5 },
  marketplace: { maxRequests: 300, windowMs: 60000, burstSize: 20 },
  statistics: { maxRequests: 60, windowMs: 60000, burstSize: 5 },
  supplies: { maxRequests: 30, windowMs: 60000, burstSize: 10 },
};

export class WildberriesClient extends BaseMarketplaceClient {
  protected readonly marketplace = 'wildberries';
  private readonly token: string;
  private readonly apiType: 'content' | 'marketplace' | 'statistics' | 'supplies';

  constructor(
    credentials: WildberriesCredentials,
    apiType: 'content' | 'marketplace' | 'statistics' | 'supplies' = 'content',
  ) {
    const token = getWildberriesToken(credentials);
    super({
      baseURL: WB_BASE_URLS[apiType],
      headers: {
        Authorization: token,
      },
      rateLimitConfig: WB_RATE_LIMITS[apiType],
    });
    this.token = token;
    this.apiType = apiType;
  }

  /**
   * Create a client for a different API type (reuses token)
   */
  forApi(apiType: 'content' | 'marketplace' | 'statistics' | 'supplies'): WildberriesClient {
    if (apiType === this.apiType) {
      return this;
    }
    return new WildberriesClient({ token: this.token }, apiType);
  }

  // === Products ===

  async getProductsList(params: {
    limit?: number;
    updatedAt?: string;
    nmID?: number;
    withPhoto?: number;
  }): Promise<WBProductsListResponse> {
    return this.request<WBProductsListResponse>({
      method: 'POST',
      url: '/content/v2/get/cards/list',
      data: {
        settings: {
          cursor: {
            limit: params.limit || 100,
            ...(params.nmID && { nmID: params.nmID }),
            ...(params.updatedAt && { updatedAt: params.updatedAt }),
          },
          filter: {
            withPhoto: params.withPhoto ?? -1, // -1 = все товары (с фото и без)
          },
        },
      },
    });
  }

  async getCardsLimits(): Promise<{ freeLimits: number; paidLimits: number }> {
    return this.request({
      method: 'GET',
      url: '/content/v2/cards/limits',
    });
  }

  // === Prices ===

  async updatePrices(prices: WBPriceUpdate[]): Promise<{ uploadId: number }> {
    return this.request({
      method: 'POST',
      url: '/api/v2/upload/task',
      data: prices,
    });
  }

  async getProductsWithPrices(params?: {
    limit?: number;
    offset?: number;
    filterNmID?: number;
  }): Promise<{
    data: {
      listGoods: Array<{
        nmID: number;
        vendorCode: string;
        sizes: Array<{
          sizeID: number;
          price: number;
          discountedPrice: number;
          techSizeName: string;
        }>;
      }>;
    };
  }> {
    // This endpoint is on marketplace API, switch if needed
    const client = this.forApi('marketplace');
    return client.request({
      method: 'GET',
      url: '/api/v2/list/goods/filter',
      params: {
        limit: params?.limit || 1000,
        offset: params?.offset || 0,
        ...(params?.filterNmID && { filterNmID: params.filterNmID }),
      },
    });
  }

  // === Stocks ===

  async getStocks(
    warehouseId: number,
    skus: string[],
  ): Promise<{ stocks: Array<{ sku: string; amount: number }> }> {
    // This endpoint is on marketplace API
    const client = this.forApi('marketplace');
    return client.request({
      method: 'POST',
      url: `/api/v3/stocks/${warehouseId}`,
      data: { skus },
    });
  }

  async updateStocks(
    warehouseId: number,
    stocks: WBStockUpdate[],
  ): Promise<void> {
    // This endpoint is on marketplace API
    const client = this.forApi('marketplace');
    await client.request({
      method: 'PUT',
      url: `/api/v3/stocks/${warehouseId}`,
      data: { stocks },
    });
  }

  // === Warehouses ===

  async getWarehouses(): Promise<WBWarehouse[]> {
    // This endpoint is on marketplace API
    const client = this.forApi('marketplace');
    return client.request({
      method: 'GET',
      url: '/api/v3/warehouses',
    });
  }

  // === Orders (Marketplace API) ===

  async getNewOrders(params?: {
    next?: number;
    limit?: number;
    dateFrom?: number;
    dateTo?: number;
  }): Promise<{
    next: number;
    orders: Array<{
      id: number;
      rid: string;
      createdAt: string;
      warehouseId: number;
      supplyId?: string;
      offices?: string[];
      address?: {
        fullAddress: string;
        province: string;
        area: string;
        city: string;
        street: string;
        home: string;
        flat: string;
        entrance: string;
        longitude: number;
        latitude: number;
      };
      skus: string[];
      price: number;
      convertedPrice: number;
      currencyCode: number;
      orderUid: string;
      nmId: number;
      chrtId: number;
      article: string;
    }>;
  }> {
    return this.request({
      method: 'GET',
      url: '/api/v3/orders/new',
      params: {
        limit: params?.limit || 100,
        ...(params?.next && { next: params.next }),
        ...(params?.dateFrom && { dateFrom: params.dateFrom }),
        ...(params?.dateTo && { dateTo: params.dateTo }),
      },
    });
  }

  protected normalizeError(error: AxiosError): MarketplaceError {
    const status = error.response?.status;
    const data = error.response?.data as { errorText?: string; error?: string } | undefined;
    const message = data?.errorText || data?.error || error.message;
    const errorType = status ? this.classifyHttpError(status) : MarketplaceErrorType.NETWORK_ERROR;

    return new WildberriesApiError(message, errorType, status, data);
  }
}

// Factory function to create clients for different APIs
export function createWildberriesClient(
  credentials: WildberriesCredentials,
  apiType: 'content' | 'marketplace' | 'statistics' | 'supplies' = 'content',
): WildberriesClient {
  return new WildberriesClient(credentials, apiType);
}
