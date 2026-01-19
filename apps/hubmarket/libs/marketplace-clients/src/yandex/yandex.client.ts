import { AxiosError } from 'axios';
import { BaseMarketplaceClient } from '../base/base-client';
import {
  MarketplaceError,
  MarketplaceErrorType,
  YandexMarketApiError,
} from '../base/errors';

export interface YandexCredentials {
  apiKey?: string;
  oauthToken?: string;  // Alias for apiKey
  businessId: string | number;
  campaignId: string | number;
}

function getYandexApiKey(credentials: YandexCredentials): string {
  const key = credentials.apiKey || credentials.oauthToken;
  if (!key) {
    throw new Error('Yandex apiKey or oauthToken is required');
  }
  return key;
}

// Types based on docs/api/yandex-market/business.md and fbs.md
export interface YandexOffer {
  offerId: string;
  name: string;
  vendor?: string;
  description?: string;
  barcodes?: string[];
  pictures?: string[];
  manufacturerCountries?: string[];
  weightDimensions?: {
    length: number;
    width: number;
    height: number;
    weight: number;
  };
  basicPrice?: {
    value: number;
    currencyId: string;
  };
  characteristics?: Array<{
    name: string;
    value: string;
  }>;
  archived?: boolean;
}

export interface YandexOfferMappingsResponse {
  status: string;
  result: {
    offerMappings: Array<{
      offer: YandexOffer;
      mapping?: {
        marketSku?: number;
        categoryId?: number;
      };
    }>;
    paging?: {
      nextPageToken?: string;
    };
  };
}

export interface YandexPriceUpdate {
  offerId: string;
  price: {
    value: number;
    currencyId: string;
  };
}

export interface YandexStockUpdate {
  sku: string;
  warehouseId: number;
  items: Array<{
    count: number;
    type: 'FIT' | 'DEFECT' | 'EXPIRED';
    updatedAt: string;
  }>;
}

const YANDEX_BASE_URL = 'https://api.partner.market.yandex.ru';
const YANDEX_RATE_LIMIT = { maxRequests: 300, windowMs: 60000 };

export class YandexMarketClient extends BaseMarketplaceClient {
  protected readonly marketplace = 'yandex_market';
  private readonly businessId: string;
  private readonly campaignId: string;

  constructor(credentials: YandexCredentials) {
    const apiKey = getYandexApiKey(credentials);
    super({
      baseURL: YANDEX_BASE_URL,
      headers: {
        'Api-Key': apiKey,
      },
      rateLimitConfig: YANDEX_RATE_LIMIT,
      retryConfig: {
        maxRetries: 3,
      },
    });
    this.businessId = String(credentials.businessId);
    this.campaignId = String(credentials.campaignId);
  }

  // === Products (Business API) ===

  async getOfferMappings(params?: {
    page_token?: string;
    limit?: number;
    offerIds?: string[];
  }): Promise<YandexOfferMappingsResponse> {
    return this.request({
      method: 'POST',
      url: `/v2/businesses/${this.businessId}/offer-mappings`,
      data: {
        ...(params?.offerIds && { offerIds: params.offerIds }),
      },
      params: {
        page_token: params?.page_token,
        limit: params?.limit || 200,
      },
    });
  }

  async updateOfferMappings(
    offerMappings: Array<{
      offer: {
        offerId: string;
        name: string;
        vendor?: string;
        description?: string;
        barcodes?: string[];
        pictures?: string[];
        manufacturerCountries?: string[];
        weightDimensions?: {
          length: number;
          width: number;
          height: number;
          weight: number;
        };
      };
    }>,
  ): Promise<{
    status: string;
    result?: {
      rejectedOffers?: Array<{
        offerId: string;
        errors: Array<{ code: string; message: string }>;
      }>;
    };
  }> {
    return this.request({
      method: 'POST',
      url: `/v2/businesses/${this.businessId}/offer-mappings/update`,
      data: { offerMappings },
    });
  }

  async deleteOfferMappings(offerIds: string[]): Promise<{ status: string }> {
    return this.request({
      method: 'POST',
      url: `/v2/businesses/${this.businessId}/offer-mappings/delete`,
      data: { offerIds },
    });
  }

  async archiveOffers(offerIds: string[]): Promise<{ status: string }> {
    return this.request({
      method: 'POST',
      url: `/v2/businesses/${this.businessId}/offer-mappings/archive`,
      data: { offerIds },
    });
  }

  // === Prices (Business API) ===

  async updatePrices(
    offers: YandexPriceUpdate[],
  ): Promise<{
    status: string;
    result?: {
      notUpdatedOffers?: Array<{
        offerId: string;
        errors: Array<{ code: string; message: string }>;
      }>;
    };
  }> {
    return this.request({
      method: 'POST',
      url: `/v2/businesses/${this.businessId}/offer-prices/updates`,
      data: { offers },
    });
  }

  async getPrices(params?: {
    page_token?: string;
    limit?: number;
    offerIds?: string[];
  }): Promise<{
    status: string;
    result: {
      offers: Array<{
        offerId: string;
        price?: { value: number; currencyId: string };
      }>;
      paging?: { nextPageToken?: string };
    };
  }> {
    return this.request({
      method: 'POST',
      url: `/v2/businesses/${this.businessId}/offer-prices`,
      data: {
        ...(params?.offerIds && { offerIds: params.offerIds }),
      },
      params: {
        page_token: params?.page_token,
        limit: params?.limit || 200,
      },
    });
  }

  // === Stocks (FBS Campaign API) ===

  async updateStocks(skus: YandexStockUpdate[]): Promise<{ status: string }> {
    return this.request({
      method: 'PUT',
      url: `/v2/campaigns/${this.campaignId}/offers/stocks`,
      data: { skus },
    });
  }

  async getStocks(params?: {
    page_token?: string;
    limit?: number;
    offerIds?: string[];
  }): Promise<{
    status: string;
    result: {
      warehouses: Array<{
        warehouseId: number;
        offers: Array<{
          offerId: string;
          stocks: Array<{
            type: string;
            count: number;
          }>;
        }>;
      }>;
      paging?: { nextPageToken?: string };
    };
  }> {
    return this.request({
      method: 'POST',
      url: `/v2/campaigns/${this.campaignId}/offers/stocks`,
      data: {
        ...(params?.offerIds && { offerIds: params.offerIds }),
      },
      params: {
        page_token: params?.page_token,
        limit: params?.limit || 200,
      },
    });
  }

  // === Warehouses ===

  async getWarehouses(): Promise<{
    status: string;
    result: {
      warehouses: Array<{
        id: number;
        name: string;
        campaignId?: number;
      }>;
    };
  }> {
    return this.request({
      method: 'POST',
      url: `/v2/businesses/${this.businessId}/warehouses`,
      data: {},
    });
  }

  // === Campaigns ===

  async getCampaigns(): Promise<{
    campaigns: Array<{
      id: number;
      domain?: string;
      placementType?: string;
      business?: { id: number; name: string };
    }>;
  }> {
    return this.request({
      method: 'GET',
      url: '/v2/campaigns',
    });
  }

  // === Orders (FBS) ===

  async getOrders(params?: {
    status?: string;
    substatus?: string;
    fromDate?: string;
    toDate?: string;
    page?: number;
    pageSize?: number;
  }): Promise<{
    status: string;
    result: {
      orders: Array<{
        id: number;
        status: string;
        substatus?: string;
        creationDate: string;
        items: Array<{
          offerId: string;
          offerName: string;
          count: number;
          price: number;
        }>;
      }>;
      paging: {
        total: number;
        currentPage: number;
        pageSize: number;
      };
    };
  }> {
    return this.request({
      method: 'GET',
      url: `/v2/campaigns/${this.campaignId}/orders`,
      params: {
        status: params?.status,
        substatus: params?.substatus,
        fromDate: params?.fromDate,
        toDate: params?.toDate,
        page: params?.page || 1,
        pageSize: params?.pageSize || 50,
      },
    });
  }

  protected normalizeError(error: AxiosError): MarketplaceError {
    const data = error.response?.data as {
      status?: string;
      errors?: Array<{ code?: string; message?: string }>;
    } | undefined;
    const message =
      data?.errors?.map((e) => e.message).join('; ') || error.message;
    const errorType = error.response?.status
      ? this.classifyHttpError(error.response.status)
      : MarketplaceErrorType.NETWORK_ERROR;

    return new YandexMarketApiError(
      message,
      errorType,
      data?.status,
      data?.errors,
    );
  }
}
