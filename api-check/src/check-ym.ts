/**
 * Проверка API Яндекс.Маркет (Partner API).
 *
 * Запуск:
 *   npm run ym                   — все пробы
 *   npm run ym -- --full         — полные примеры
 *   npm run ym -- --json         — сырой JSON
 *   npm run ym -- --only orders
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

const BASE = 'https://api.partner.market.yandex.ru';

const dayAgo = (days: number): string => new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);

export const YM_TITLE = 'Яндекс.Маркет';

export function ymProbes(): ProbeDef[] {
  const H = { 'Api-Key': requireEnv('YM_API_TOKEN') };
  const business = requireEnv('YM_BUSINESS_ID');
  const campaign = requireEnv('YM_CAMPAIGN_ID');

  return [
    {
      name: 'Магазины (кампании)',
      category: 'campaigns',
      run: async () => {
        const r = await http('GET', `${BASE}/v2/campaigns?pageSize=50`, { headers: H });
        const camps = r.body?.campaigns;
        const cmp = camps?.[0];
        return { http: r, count: len(camps), sample: cmp && { id: cmp.id, domain: cmp.domain } };
      },
    },
    {
      name: 'Товары (offer-mappings)',
      category: 'products',
      run: async () => {
        const r = await http('POST', `${BASE}/v2/businesses/${business}/offer-mappings?limit=10`, {
          headers: H,
          body: { archived: false },
        });
        const items = r.body?.result?.offerMappings;
        const offer = items?.[0]?.offer;
        return { http: r, count: len(items), sample: offer && { offerId: offer.offerId, name: offer.name } };
      },
    },
    {
      name: 'Остатки',
      category: 'stocks',
      run: async () => {
        const r = await http('POST', `${BASE}/v2/campaigns/${campaign}/offers/stocks`, {
          headers: H,
          body: { limit: 10 },
        });
        const whs = r.body?.result?.warehouses;
        return { http: r, count: len(whs), sample: whs?.[0]?.offers?.[0] };
      },
    },
    {
      name: 'Цены',
      category: 'prices',
      run: async () => {
        const r = await http('POST', `${BASE}/v2/campaigns/${campaign}/offer-prices`, {
          headers: H,
          body: { limit: 10 },
        });
        const offers = r.body?.result?.offers;
        const o = offers?.[0];
        return { http: r, count: len(offers), sample: o && { offerId: o.offerId, price: o.price } };
      },
    },
    {
      name: 'Заказы (30 дней)',
      category: 'orders',
      run: async () => {
        const r = await http('POST', `${BASE}/v1/businesses/${business}/orders`, {
          headers: H,
          body: { dates: { creationDateFrom: dayAgo(30), creationDateTo: dayAgo(0) } },
        });
        const orders = r.body?.orders;
        const ord = orders?.[0];
        return { http: r, count: len(orders), sample: ord && { id: ord.id, status: ord.status } };
      },
    },
    {
      name: 'Дерево категорий',
      category: 'categories',
      run: async () => {
        const r = await http('POST', `${BASE}/v2/categories/tree`, { headers: H, body: {} });
        const children = r.body?.result?.children;
        const ch = children?.[0];
        return { http: r, count: len(children), sample: ch && { id: ch.id, name: ch.name } };
      },
    },
  ];
}

async function main(): Promise<void> {
  const envPath = loadEnv();
  const proxy = await installProxy();
  printHeader(envPath, proxy);
  const flags = parseFlags();
  const results = await runSuite(YM_TITLE, ymProbes(), flags);
  applyExitCode(results);
}

if (isMain(import.meta.url)) await main();
