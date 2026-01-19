export enum MarketplaceErrorType {
  // Retryable errors
  RATE_LIMIT = 'RATE_LIMIT',
  SERVER_ERROR = 'SERVER_ERROR',
  NETWORK_ERROR = 'NETWORK_ERROR',
  TIMEOUT = 'TIMEOUT',

  // Non-retryable errors
  VALIDATION = 'VALIDATION',
  AUTH = 'AUTH',
  FORBIDDEN = 'FORBIDDEN',
  NOT_FOUND = 'NOT_FOUND',
  CONFLICT = 'CONFLICT',
  UNKNOWN = 'UNKNOWN',
}

export class MarketplaceError extends Error {
  constructor(
    message: string,
    public readonly type: MarketplaceErrorType,
    public readonly marketplace: string,
    public readonly statusCode?: number,
    public readonly originalError?: unknown,
    public readonly response?: unknown,
  ) {
    super(message);
    this.name = 'MarketplaceError';
  }

  isRetryable(): boolean {
    return [
      MarketplaceErrorType.RATE_LIMIT,
      MarketplaceErrorType.SERVER_ERROR,
      MarketplaceErrorType.NETWORK_ERROR,
      MarketplaceErrorType.TIMEOUT,
    ].includes(this.type);
  }

  getRetryDelay(): number {
    switch (this.type) {
      case MarketplaceErrorType.RATE_LIMIT:
        return 60000; // 1 minute for rate limit
      case MarketplaceErrorType.SERVER_ERROR:
        return 5000; // 5 seconds for server error
      case MarketplaceErrorType.NETWORK_ERROR:
        return 1000; // 1 second for network error
      case MarketplaceErrorType.TIMEOUT:
        return 5000; // 5 seconds for timeout
      default:
        return 0;
    }
  }
}

export class WildberriesApiError extends MarketplaceError {
  constructor(
    message: string,
    type: MarketplaceErrorType,
    statusCode?: number,
    response?: unknown,
  ) {
    super(message, type, 'wildberries', statusCode, undefined, response);
    this.name = 'WildberriesApiError';
  }
}

export class OzonApiError extends MarketplaceError {
  constructor(
    message: string,
    type: MarketplaceErrorType,
    public readonly code?: number,
    public readonly details?: unknown[],
  ) {
    super(message, type, 'ozon', undefined, undefined, { code, details });
    this.name = 'OzonApiError';
  }
}

export class YandexMarketApiError extends MarketplaceError {
  constructor(
    message: string,
    type: MarketplaceErrorType,
    public readonly status?: string,
    public readonly errors?: unknown[],
  ) {
    super(message, type, 'yandex_market', undefined, undefined, { status, errors });
    this.name = 'YandexMarketApiError';
  }
}
