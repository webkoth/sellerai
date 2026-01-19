import { WildberriesClient, WildberriesCredentials } from './wildberries/wildberries.client';
import { OzonClient, OzonCredentials } from './ozon/ozon.client';
import { YandexMarketClient, YandexCredentials } from './yandex/yandex.client';

// Re-define MarketplaceType locally to avoid circular dependency with @hubmarket/core
export type MarketplaceType = 'wildberries' | 'ozon' | 'yandex_market';

export type MarketplaceClientCredentials =
  | { type: 'wildberries'; credentials: WildberriesCredentials; apiType?: 'content' | 'marketplace' | 'statistics' | 'supplies' }
  | { type: 'ozon'; credentials: OzonCredentials }
  | { type: 'yandex_market'; credentials: YandexCredentials };

export type MarketplaceClient = WildberriesClient | OzonClient | YandexMarketClient;

export class MarketplaceClientFactory {
  static create(config: MarketplaceClientCredentials): MarketplaceClient {
    switch (config.type) {
      case 'wildberries':
        return new WildberriesClient(config.credentials, config.apiType);
      case 'ozon':
        return new OzonClient(config.credentials);
      case 'yandex_market':
        return new YandexMarketClient(config.credentials);
      default:
        throw new Error(`Unknown marketplace type`);
    }
  }

  static createFromAccount(
    marketplace: MarketplaceType,
    credentials: Record<string, unknown>,
  ): MarketplaceClient {
    switch (marketplace) {
      case 'wildberries':
        return new WildberriesClient({
          token: credentials.token as string,
        });
      case 'ozon':
        return new OzonClient({
          clientId: credentials.clientId as string,
          apiKey: credentials.apiKey as string,
        });
      case 'yandex_market':
        return new YandexMarketClient({
          apiKey: credentials.apiKey as string,
          businessId: credentials.businessId as string,
          campaignId: credentials.campaignId as string,
        });
      default:
        throw new Error(`Unknown marketplace: ${marketplace}`);
    }
  }
}
