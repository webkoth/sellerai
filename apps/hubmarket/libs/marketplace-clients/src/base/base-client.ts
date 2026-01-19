import axios, {
  AxiosInstance,
  AxiosRequestConfig,
  AxiosError,
  AxiosResponse,
} from 'axios';
import { RateLimiter } from './rate-limiter';
import { MarketplaceError, MarketplaceErrorType } from './errors';

export interface RetryConfig {
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
  jitter: boolean;
}

export interface BaseClientConfig {
  baseURL: string;
  headers: Record<string, string>;
  rateLimitConfig: {
    maxRequests: number;
    windowMs: number;
    burstSize?: number;
  };
  retryConfig?: Partial<RetryConfig>;
  timeout?: number;
}

export abstract class BaseMarketplaceClient {
  protected httpClient: AxiosInstance;
  protected rateLimiter: RateLimiter;
  protected retryConfig: RetryConfig;
  protected abstract readonly marketplace: string;

  constructor(config: BaseClientConfig) {
    this.httpClient = axios.create({
      baseURL: config.baseURL,
      headers: {
        'Content-Type': 'application/json',
        ...config.headers,
      },
      timeout: config.timeout || 30000,
    });

    this.rateLimiter = new RateLimiter(
      config.rateLimitConfig.maxRequests,
      config.rateLimitConfig.windowMs,
      config.rateLimitConfig.burstSize,
    );

    this.retryConfig = {
      maxRetries: config.retryConfig?.maxRetries ?? 3,
      baseDelay: config.retryConfig?.baseDelay ?? 1000,
      maxDelay: config.retryConfig?.maxDelay ?? 30000,
      jitter: config.retryConfig?.jitter ?? true,
    };

    this.setupInterceptors();
  }

  private setupInterceptors(): void {
    // Request interceptor for rate limiting
    this.httpClient.interceptors.request.use(
      async (config) => {
        await this.rateLimiter.acquire();
        return config;
      },
      (error) => Promise.reject(error),
    );

    // Response interceptor for error handling
    this.httpClient.interceptors.response.use(
      (response) => response,
      async (error: AxiosError) => {
        throw this.normalizeError(error);
      },
    );
  }

  protected async request<T>(
    config: AxiosRequestConfig,
    attempt = 0,
  ): Promise<T> {
    try {
      const response: AxiosResponse<T> = await this.httpClient.request(config);
      return response.data;
    } catch (error) {
      if (
        error instanceof MarketplaceError &&
        error.isRetryable() &&
        attempt < this.retryConfig.maxRetries
      ) {
        const delay = this.calculateRetryDelay(attempt, error);
        await this.sleep(delay);
        return this.request<T>(config, attempt + 1);
      }
      throw error;
    }
  }

  private calculateRetryDelay(attempt: number, error: MarketplaceError): number {
    let delay = Math.min(
      this.retryConfig.baseDelay * Math.pow(2, attempt),
      this.retryConfig.maxDelay,
    );

    // Use error-specific delay if longer
    const errorDelay = error.getRetryDelay();
    if (errorDelay > delay) {
      delay = errorDelay;
    }

    // Add jitter to prevent thundering herd
    if (this.retryConfig.jitter) {
      const jitter = Math.random() * 0.3 * delay;
      delay = delay + jitter;
    }

    return Math.floor(delay);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  protected classifyHttpError(status: number): MarketplaceErrorType {
    if (status === 429) return MarketplaceErrorType.RATE_LIMIT;
    if (status === 400) return MarketplaceErrorType.VALIDATION;
    if (status === 401) return MarketplaceErrorType.AUTH;
    if (status === 403) return MarketplaceErrorType.FORBIDDEN;
    if (status === 404) return MarketplaceErrorType.NOT_FOUND;
    if (status === 409) return MarketplaceErrorType.CONFLICT;
    if (status >= 500) return MarketplaceErrorType.SERVER_ERROR;
    return MarketplaceErrorType.UNKNOWN;
  }

  protected abstract normalizeError(error: AxiosError): MarketplaceError;

  /**
   * Get rate limiter status for monitoring
   */
  getRateLimiterStatus(): { availableTokens: number; waitTime: number } {
    return {
      availableTokens: this.rateLimiter.getAvailableTokens(),
      waitTime: this.rateLimiter.getWaitTime(),
    };
  }
}
