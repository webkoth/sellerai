/**
 * Проверка API Wildberries.
 *
 * Запуск:
 *   npm run wb                  — все пробы
 *   npm run wb -- --full        — полные примеры данных
 *   npm run wb -- --json        — сырой JSON каждого ответа
 *   npm run wb -- --only prices — только пробы со словом "prices"
 *   npm run wb -- --quiet       — только статусы
 */

import {
  applyExitCode,
  http,
  installProxy,
  isMain,
  len,
  loadEnv,
  parseFlags,
  printHeader,
  requireEnv,
  runSuite,
  type ProbeDef,
} from './lib.ts';

// Базовые URL по категориям API (dev.wildberries.ru/openapi/api-information)
const U = {
  common: 'https://common-api.wildberries.ru',
  content: 'https://content-api.wildberries.ru',
  stats: 'https://statistics-api.wildberries.ru',
  prices: 'https://discounts-prices-api.wildberries.ru',
  marketplace: 'https://marketplace-api.wildberries.ru',
  feedbacks: 'https://feedbacks-api.wildberries.ru',
  advert: 'https://advert-api.wildberries.ru',
  analytics: 'https://seller-analytics-api.wildberries.ru',
  finance: 'https://finance-api.wildberries.ru',
} as const;

const dateAgo = (days: number): string => new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);

export const WB_TITLE = 'Wildberries';

export function wbProbes(): ProbeDef[] {
  const H = { Authorization: requireEnv('WB_API_TOKEN') };

  return [
    {
      name: 'Профиль продавца',
      category: 'common',
      run: async () => {
        const r = await http('GET', `${U.common}/api/v1/seller-info`, { headers: H });
        return { http: r, sample: r.body && { name: r.body.name, sid: r.body.sid, tradeMark: r.body.tradeMark } };
      },
    },
    {
      name: 'Баланс',
      category: 'finance',
      run: async () => {
        const r = await http('GET', `${U.finance}/api/v1/account/balance`, { headers: H });
        return { http: r, sample: r.body };
      },
    },
    {
      name: 'Цены и скидки',
      category: 'prices',
      run: async () => {
        const r = await http('GET', `${U.prices}/api/v2/list/goods/filter?limit=10&offset=0`, { headers: H });
        const goods = r.body?.data?.listGoods;
        return { http: r, count: len(goods), sample: goods?.[0] };
      },
    },
    {
      name: 'Карточки товаров',
      category: 'content',
      run: async () => {
        const r = await http('POST', `${U.content}/content/v2/get/cards/list`, {
          headers: H,
          body: { settings: { cursor: { limit: 10 }, filter: { withPhoto: -1 } } },
        });
        const cards = r.body?.cards;
        const card = cards?.[0];
        return {
          http: r,
          count: len(cards),
          note: r.body?.cursor?.total != null ? `всего карточек: ${r.body.cursor.total}` : undefined,
          sample: card && { nmID: card.nmID, vendorCode: card.vendorCode, title: card.title },
        };
      },
    },
    {
      name: 'Остатки (statistics)',
      category: 'statistics',
      run: async () => {
        const r = await http('GET', `${U.stats}/api/v1/supplier/stocks?dateFrom=${dateAgo(90)}`, { headers: H });
        return { http: r, count: len(r.body), sample: r.body?.[0] };
      },
    },
    {
      name: 'Заказы (7 дней)',
      category: 'statistics',
      run: async () => {
        const r = await http('GET', `${U.stats}/api/v1/supplier/orders?dateFrom=${dateAgo(7)}&flag=0`, { headers: H });
        return { http: r, count: len(r.body), sample: r.body?.[0] };
      },
    },
    {
      name: 'Продажи (7 дней)',
      category: 'statistics',
      run: async () => {
        const r = await http('GET', `${U.stats}/api/v1/supplier/sales?dateFrom=${dateAgo(7)}&flag=0`, { headers: H });
        return { http: r, count: len(r.body), sample: r.body?.[0] };
      },
    },
    {
      name: 'Склады FBS',
      category: 'marketplace',
      run: async () => {
        const r = await http('GET', `${U.marketplace}/api/v3/warehouses`, { headers: H });
        return { http: r, count: len(r.body), sample: r.body?.[0] };
      },
    },
    {
      name: 'Отзывы (без ответа)',
      category: 'feedbacks',
      run: async () => {
        const r = await http('GET', `${U.feedbacks}/api/v1/feedbacks?isAnswered=false&take=10&skip=0`, { headers: H });
        const fb = r.body?.data?.feedbacks;
        const f = fb?.[0];
        return {
          http: r,
          count: len(fb),
          note: r.body?.data?.countUnanswered != null ? `без ответа: ${r.body.data.countUnanswered}` : undefined,
          sample: f && { id: f.id, valuation: f.productValuation, text: f.text },
        };
      },
    },
    {
      name: 'Рекламные кампании',
      category: 'advert',
      run: async () => {
        const r = await http('GET', `${U.advert}/adv/v1/promotion/count`, { headers: H });
        return { http: r, count: r.body?.all, sample: r.body?.adverts?.[0] };
      },
    },
    {
      name: 'Воронка (Джем)',
      category: 'analytics',
      run: async () => {
        const r = await http('POST', `${U.analytics}/api/v2/nm-report/detail`, {
          headers: H,
          body: { period: { begin: dateAgo(7), end: dateAgo(0) }, page: 1 },
        });
        const cards = r.body?.data?.cards;
        // 403 — нет подписки «Джем», это ожидаемо и не считается падением API
        return {
          http: r,
          ok: r.ok || r.status === 403,
          count: len(cards),
          note: r.status === 403 ? 'нет подписки «Джем» (ожидаемо)' : undefined,
          sample: cards?.[0]?.statistics,
        };
      },
    },
  ];
}

async function main(): Promise<void> {
  const envPath = loadEnv();
  const proxy = await installProxy();
  printHeader(envPath, proxy);
  const flags = parseFlags();
  const results = await runSuite(WB_TITLE, wbProbes(), flags);
  applyExitCode(results);
}

if (isMain(import.meta.url)) await main();
