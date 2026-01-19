export type MarketplaceType = 'wildberries' | 'ozon' | 'yandex_market';

export interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
  burstSize?: number;
}

export const MARKETPLACE_RATE_LIMITS: Record<string, RateLimitConfig> = {
  // Wildberries
  'wildberries:content': { maxRequests: 60, windowMs: 60000, burstSize: 5 },
  'wildberries:marketplace': { maxRequests: 300, windowMs: 60000, burstSize: 20 },
  'wildberries:supplies': { maxRequests: 30, windowMs: 60000, burstSize: 10 },
  'wildberries:advert': { maxRequests: 300, windowMs: 60000, burstSize: 10 },
  'wildberries:statistics': { maxRequests: 60, windowMs: 60000, burstSize: 5 },

  // Ozon
  ozon: { maxRequests: 300, windowMs: 60000 },

  // Yandex Market
  yandex_market: { maxRequests: 300, windowMs: 60000 },
};

export const MARKETPLACE_BASE_URLS: Record<string, Record<string, string>> = {
  wildberries: {
    common: 'https://common-api.wildberries.ru',
    content: 'https://content-api.wildberries.ru',
    marketplace: 'https://marketplace-api.wildberries.ru',
    statistics: 'https://statistics-api.wildberries.ru',
    advert: 'https://advert-api.wildberries.ru',
    supplies: 'https://supplies-api.wildberries.ru',
    feedbacks: 'https://feedbacks-api.wildberries.ru',
    documents: 'https://documents-api.wildberries.ru',
  },
  ozon: {
    seller: 'https://api-seller.ozon.ru',
  },
  yandex_market: {
    partner: 'https://api.partner.market.yandex.ru',
  },
};
