/**
 * Проверка API Ozon (Seller API).
 *
 * Запуск:
 *   npm run ozon                 — все пробы
 *   npm run ozon -- --full       — полные примеры
 *   npm run ozon -- --json       — сырой JSON
 *   npm run ozon -- --only stocks
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

const BASE = 'https://api-seller.ozon.ru';

const isoAgo = (days: number): string => new Date(Date.now() - days * 86_400_000).toISOString();
const dayAgo = (days: number): string => isoAgo(days).slice(0, 10);

export const OZON_TITLE = 'Ozon';

export function ozonProbes(): ProbeDef[] {
  const H = {
    'Client-Id': requireEnv('OZON_CLIENT_ID'),
    'Api-Key': requireEnv('OZON_API_TOKEN'),
  };

  return [
    {
      name: 'Список товаров',
      category: 'product',
      run: async () => {
        const r = await http('POST', `${BASE}/v3/product/list`, {
          headers: H,
          body: { filter: { visibility: 'ALL' }, limit: 10 },
        });
        const items = r.body?.result?.items;
        return {
          http: r,
          count: len(items),
          note: r.body?.result?.total != null ? `всего: ${r.body.result.total}` : undefined,
          sample: items?.[0],
        };
      },
    },
    {
      name: 'Остатки FBO/FBS',
      category: 'stocks',
      run: async () => {
        const r = await http('POST', `${BASE}/v4/product/info/stocks`, {
          headers: H,
          body: { filter: { visibility: 'ALL' }, limit: 10 },
        });
        const items = r.body?.items;
        return { http: r, count: len(items), sample: items?.[0] };
      },
    },
    {
      name: 'Цены и комиссии',
      category: 'prices',
      run: async () => {
        const r = await http('POST', `${BASE}/v5/product/info/prices`, {
          headers: H,
          body: { filter: { visibility: 'ALL' }, limit: 10 },
        });
        const items = r.body?.items;
        const it = items?.[0];
        return { http: r, count: len(items), sample: it && { offer_id: it.offer_id, price: it.price } };
      },
    },
    {
      name: 'Заказы FBS (30 дней)',
      category: 'orders',
      run: async () => {
        const r = await http('POST', `${BASE}/v3/posting/fbs/list`, {
          headers: H,
          body: { dir: 'ASC', filter: { since: isoAgo(30), to: isoAgo(0) }, limit: 10, offset: 0 },
        });
        const postings = r.body?.result?.postings;
        const p = postings?.[0];
        return { http: r, count: len(postings), sample: p && { posting_number: p.posting_number, status: p.status } };
      },
    },
    {
      name: 'Денежный поток',
      category: 'finance',
      run: async () => {
        const r = await http('POST', `${BASE}/v1/finance/cash-flow-statement/list`, {
          headers: H,
          body: {
            date: { from: `${dayAgo(30)}T00:00:00.000Z`, to: `${dayAgo(0)}T23:59:59.999Z` },
            page: 1,
            page_size: 100,
            with_details: false,
          },
        });
        const cf = r.body?.result?.cash_flows;
        return { http: r, count: len(cf), sample: cf?.[0] };
      },
    },
    {
      name: 'Дерево категорий',
      category: 'categories',
      run: async () => {
        const r = await http('POST', `${BASE}/v1/description-category/tree`, { headers: H, body: {} });
        const tree = r.body?.result;
        const node = tree?.[0];
        return {
          http: r,
          count: len(tree),
          sample: node && {
            category_id: node.category_id ?? node.description_category_id,
            name: node.category_name ?? node.name,
            children: len(node.children),
          },
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
  const results = await runSuite(OZON_TITLE, ozonProbes(), flags);
  applyExitCode(results);
}

if (isMain(import.meta.url)) await main();
