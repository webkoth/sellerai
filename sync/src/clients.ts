/**
 * Слой доступа к данным трёх МП. Переиспользует собранные dist-функции MCP-серверов;
 * запись остатков — через нативные API (проверено харнессами): WB updateStocksFBS,
 * Ozon /v2/products/stocks, ЯМ PUT /v2/campaigns/{id}/offers/stocks.
 */
import { getProductsInStock } from '../../mcp/wb-mcp/dist/tools/products-in-stock.js';
import { updateStocksFBS, getSellerWarehouses } from '../../mcp/wb-mcp/dist/tools/inventory.js';
import { createWBHeaders, WB_API_URLS } from '../../mcp/wb-mcp/dist/utils/auth.js';
import { getStocks as ozGetStocks } from '../../mcp/ozon-mcp/dist/tools/stocks.js';
import { getOrders as ozGetOrders } from '../../mcp/ozon-mcp/dist/tools/orders.js';
import { createOzonHeaders, OZON_API_URL } from '../../mcp/ozon-mcp/dist/utils/auth.js';
import { getPrices as ozGetPrices } from '../../mcp/ozon-mcp/dist/tools/prices.js';
import { getStocks as ymGetStocks } from '../../mcp/ym-mcp/dist/tools/stocks.js';
import { getOrders as ymGetOrders } from '../../mcp/ym-mcp/dist/tools/orders.js';
import { getPrices as ymGetPrices } from '../../mcp/ym-mcp/dist/tools/prices.js';
import { apiRequest as ymApiRequest } from '../../mcp/ym-mcp/dist/api/client.js';

import { OZ_WAREHOUSE, YM_WAREHOUSE, YM_CAMPAIGN, YM_BUSINESS, SKIP_OZON } from './config.js';
import type { Marketplace, OpenOrder } from './types.js';

const daysAgoISO = (n: number): string => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);
const isCancelled = (s: string): boolean => /cancel|отмен|reject|return|возврат/i.test(s || '');

// ---------- WB ----------
export interface WbItem {
  barcode: string;
  vendorCode: string;
  nmId: number;
  stock: number;
  category?: string;
  title?: string;
  finalPrice?: number;
  price?: number;
  discount?: number;
}

/**
 * @param pricesOptional — true для stocks/reconcile: цены WB (discounts-prices, лимит 1 запрос в ~11 мин)
 * для сверки остатков не нужны; при их сбое finalPrice=0, а wbFinal в леджере остаётся прежним.
 * cards/prices оставляют false — им цены обязательны.
 */
export async function listWbInStock(pricesOptional = false): Promise<WbItem[]> {
  // pricesOptional → цены не запрашиваем вовсе: окно discounts-prices (1 запрос в ~12 мин) бережём для cards/prices
  const wb: any = await getProductsInStock({ minQuantity: 1 }, { pricesOptional, skipPrices: pricesOptional });
  if (wb.summary?.pricesUnavailable && wb.summary.pricesUnavailable !== 'skipped by caller') console.error(`[listWbInStock] цены WB недоступны, остатки без цен: ${wb.summary.pricesUnavailable}`);
  return (wb.products || []).map((p: any) => ({
    barcode: String(p.barcode),
    vendorCode: String(p.vendorCode),
    nmId: Number(p.nmId) || 0,
    stock: Number(p.stock) || 0,
    category: p.category,
    title: p.title,
    finalPrice: Number(p.finalPrice) || Number(p.price) || 0,
    price: Number(p.price) || 0,
    discount: Number(p.discount) || 0,
  }));
}

export async function writeWbStock(changes: Array<{ key: string; amount: number }>): Promise<void> {
  if (!changes.length) return;
  await updateStocksFBS(changes.map((c) => ({ sku: c.key, amount: c.amount })));
}

export async function wbWarehouseId(): Promise<number | null> {
  const whs = await getSellerWarehouses();
  return whs[0]?.id ?? null;
}

// ---------- Ozon ----------
export async function listOzonOffers(): Promise<Array<{ key: string; available: number }>> {
  const st: any = await ozGetStocks({ limit: 1000, visibility: 'ALL' });
  // В пул идёт ТОЛЬКО FBS (наш склад «Склад Краснодар») — его мы и пишем через /v2/products/stocks.
  // FBO — единицы на складе самого Ozon: это отдельный физический запас, обнулить его API не может,
  // и учёт FBO в сравнении давал вечный фантомный дифф «1 → 0» (04.09.2026, «Лик Будды»).
  const fbo = (st.products || []).filter((s: any) => (Number(s.totalFbo) || 0) > 0);
  if (fbo.length) console.error(`[listOzonOffers] FBO-остаток у ${fbo.length} офферов (в пул не входит): ${fbo.map((s: any) => `${s.offerId}=${s.totalFbo}`).join(', ')}`);
  return (st.products || []).map((s: any) => ({
    key: String(s.offerId),
    available: Number(s.totalFbs) || 0,
  }));
}

export async function writeOzonStock(changes: Array<{ key: string; amount: number }>): Promise<{ ok: number; errors: string[] }> {
  // барьер skip-list: не пишем сток для barcode, заблокированных модерацией Ozon (остаются на WB+ЯМ)
  if (SKIP_OZON.length) {
    const skip = new Set(SKIP_OZON);
    changes = changes.filter((c) => !skip.has(c.key));
  }
  if (!changes.length) return { ok: 0, errors: [] };
  const errors: string[] = [];
  let ok = 0;
  for (let i = 0; i < changes.length; i += 100) {
    const batch = changes.slice(i, i + 100);
    const r = await fetch(`${OZON_API_URL}/v2/products/stocks`, {
      method: 'POST',
      headers: createOzonHeaders(),
      body: JSON.stringify({ stocks: batch.map((c) => ({ offer_id: c.key, stock: c.amount, warehouse_id: OZ_WAREHOUSE })) }),
    });
    const j: any = await r.json().catch(() => ({}));
    for (const res of j.result || []) {
      if (res.updated) ok++;
      else errors.push(`${res.offer_id}:${JSON.stringify((res.errors || []).map((e: any) => e.code))}`);
    }
  }
  return { ok, errors };
}

// ---------- ЯМ ----------
export async function listYmOffers(): Promise<Array<{ key: string; available: number }>> {
  // Постранично: /offers/stocks отдаёт максимум 200 за запрос (limit только в query, см. ym-mcp stocks.ts).
  // До 2026-09-10 читалась одна страница из 50 → 33 оффера с реальным остатком считались нулевыми.
  const out = new Map<string, number>();
  let stocksToken: string | undefined;
  for (let i = 0; i < 20; i++) {
    const st: any = await ymGetStocks({ limit: 200, ...(stocksToken ? { pageToken: stocksToken } : {}) });
    for (const s of st.stocks || []) out.set(String(s.offerId), Number(s.available) || 0);
    stocksToken = st.nextPageToken;
    if (!stocksToken) break;
  }
  // Офферы магазина БЕЗ записи остатка (никогда не выставлялся, статус NO_STOCKS) в /offers/stocks не приходят —
  // 04.09.2026 так «потерялись» 11 живых офферов с ценами. Добираем полный список офферов магазина, их остаток = 0,
  // чтобы сверка выставила им WB-наличие. Архивные офферы бизнеса сюда не попадают (они не в магазине).
  let pageToken: string | undefined;
  for (let i = 0; i < 20; i++) {
    const r: any = await ymApiRequest(`/v2/campaigns/${YM_CAMPAIGN}/offers?limit=200${pageToken ? `&page_token=${pageToken}` : ''}`, 'POST', {});
    for (const o of r?.result?.offers || []) if (!out.has(String(o.offerId))) out.set(String(o.offerId), 0);
    pageToken = r?.result?.paging?.nextPageToken;
    if (!pageToken) break;
  }
  return [...out].map(([key, available]) => ({ key, available }));
}

export async function writeYmStock(changes: Array<{ key: string; amount: number }>): Promise<{ ok: number; notUpdated: string[] }> {
  if (!changes.length) return { ok: 0, notUpdated: [] };
  const now = new Date().toISOString();
  const notUpdated: string[] = [];
  let ok = 0;
  for (let i = 0; i < changes.length; i += 200) {
    const batch = changes.slice(i, i + 200);
    const r: any = await ymApiRequest(`/v2/campaigns/${YM_CAMPAIGN}/offers/stocks`, 'PUT', {
      skus: batch.map((c) => ({ sku: c.key, warehouseId: YM_WAREHOUSE, items: [{ count: c.amount, type: 'FIT', updatedAt: now }] })),
    });
    const nd: string[] = r?.result?.notUpdatedOfferIds || [];
    notUpdated.push(...nd);
    ok += batch.length - nd.length;
  }
  return { ok, notUpdated };
}

// ---------- Цены (чтение) ----------

/** Полная ценовая инфа Ozon per-SKU, включая комиссии/эквайринг (MCP-обёртка их режет — идём в v5 напрямую). */
export interface OzonPriceInfo {
  offerId: string;
  price: number;                // текущая цена
  oldPrice: number;             // зачёркнутая
  marketing: number;            // цена с акциями (= витринная со скидкой)
  minPrice: number;
  vat: string;                  // '0' | '0.1' | '0.2'
  salesPercentFbs: number;      // %, комиссия за продажу FBS
  acquiring: number;            // %, максимальный эквайринг
}

export async function listOzonPriceInfo(): Promise<Map<string, OzonPriceInfo>> {
  const m = new Map<string, OzonPriceInfo>();
  let cursor = '';
  for (;;) {
    const body: Record<string, unknown> = { filter: { visibility: 'ALL' }, limit: 100 };
    if (cursor) body.cursor = cursor;
    const r = await fetch(`${OZON_API_URL}/v5/product/info/prices`, {
      method: 'POST', headers: createOzonHeaders(), body: JSON.stringify(body),
    });
    if (!r.ok) throw new Error(`Ozon v5 prices ${r.status}: ${(await r.text()).slice(0, 200)}`);
    const j: any = await r.json();
    const items: any[] = j.items || [];
    for (const it of items) {
      const key = String(it.offer_id || '');
      if (!key) continue;
      m.set(key, {
        offerId: key,
        price: Number(it.price?.price) || 0,
        oldPrice: Number(it.price?.old_price) || 0,
        marketing: Number(it.price?.marketing_seller_price) || Number(it.price?.price) || 0,
        minPrice: Number(it.price?.min_price) || 0,
        vat: String(it.price?.vat ?? '0'),
        salesPercentFbs: Number(it.commissions?.sales_percent_fbs) || 0,
        acquiring: Number(it.acquiring) || 0,
      });
    }
    cursor = j.cursor || '';
    if (!cursor || items.length < 100) break;
  }
  return m;
}

export interface YmPriceInfo { offerId: string; price: number; discountBase: number }

export async function listYmPriceInfo(): Promise<Map<string, YmPriceInfo>> {
  const r: any = await ymGetPrices({ limit: 1000 });
  const m = new Map<string, YmPriceInfo>();
  for (const x of r.prices || []) {
    const key = String(x.offerId || '');
    const price = Number(x.price) || 0;
    if (key && price > 0) m.set(key, { offerId: key, price, discountBase: Number(x.discountBase) || 0 });
  }
  return m;
}

/** nmID товаров WB в ценовом карантине (финалку двигать нельзя — заявки отклоняются). */
export async function listWbQuarantine(): Promise<Set<number>> {
  const r = await fetch(`${WB_API_URLS.prices}/api/v2/quarantine/goods?limit=1000&offset=0`, {
    headers: createWBHeaders(),
  });
  if (!r.ok) throw new Error(`WB quarantine ${r.status}: ${(await r.text()).slice(0, 200)}`);
  const j: any = await r.json().catch(() => ({}));
  const rows: any[] = j.data?.quarantineGoods || j.data || [];
  return new Set(rows.map((g: any) => Number(g.nmID)).filter(Boolean));
}

export async function listOzonPrices(): Promise<Map<string, number>> {
  const r: any = await ozGetPrices({ limit: 1000, visibility: 'ALL' });
  const rows = r.products || r.prices || r.items || [];
  const m = new Map<string, number>();
  const num = (raw: unknown): number => {
    const v = Number(typeof raw === 'string' ? raw.replace(',', '.') : raw);
    return Number.isFinite(v) && v > 0 ? v : 0;
  };
  for (const x of rows) {
    const key = String(x.offerId ?? x.offer_id ?? '');
    // marketingSellerPrice бывает пустой строкой (нет акций) — тогда берём price
    const v = num(x.marketingSellerPrice) || num(x.price);
    if (key && v > 0) m.set(key, v);
  }
  return m;
}

export async function listYmPrices(): Promise<Map<string, number>> {
  const r: any = await ymGetPrices({ limit: 1000 });
  const m = new Map<string, number>();
  for (const x of r.prices || []) {
    const v = Number(x.price);
    if (Number.isFinite(v) && v > 0) m.set(String(x.offerId), v);
  }
  return m;
}

// ---------- Цены (запись) ----------

/** WB: база + целая скидка, финалка = price×(1−discount/100). До 1000 позиций на upload task. */
export async function writeWbPrices(
  rows: Array<{ nmID: number; price: number; discount: number }>
): Promise<{ ok: number; errors: string[] }> {
  const errors: string[] = [];
  let ok = 0;
  for (let i = 0; i < rows.length; i += 1000) {
    const batch = rows.slice(i, i + 1000);
    const r = await fetch(`${WB_API_URLS.prices}/api/v2/upload/task`, {
      method: 'POST',
      headers: { ...createWBHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: batch }),
    });
    const j: any = await r.json().catch(() => ({}));
    if (!r.ok || j.error) errors.push(`WB upload ${r.status}: ${j.errorText || JSON.stringify(j).slice(0, 200)}`);
    else ok += batch.length;
  }
  return { ok, errors };
}

/** Ozon: финалка + зачёркнутая + min_price (страховка от авто-акций). Значения — строки по контракту API. */
export async function writeOzonPrices(
  rows: Array<{ offer_id: string; price: string; old_price: string; min_price: string; vat: string }>
): Promise<{ ok: number; errors: string[] }> {
  const errors: string[] = [];
  let ok = 0;
  for (let i = 0; i < rows.length; i += 100) {
    const batch = rows.slice(i, i + 100).map((x) => ({ ...x, currency_code: 'RUB' }));
    const r = await fetch(`${OZON_API_URL}/v1/product/import/prices`, {
      method: 'POST', headers: createOzonHeaders(), body: JSON.stringify({ prices: batch }),
    });
    const j: any = await r.json().catch(() => ({}));
    if (!r.ok) { errors.push(`Ozon import ${r.status}: ${JSON.stringify(j).slice(0, 300)}`); continue; }
    for (const res of j.result || []) {
      if (res.updated) ok++;
      else errors.push(`${res.offer_id}:${JSON.stringify((res.errors || []).map((e: any) => e.code))}`);
    }
  }
  return { ok, errors };
}

/** ЯМ (business-уровень): финалка value + discountBase (единая база; зачёркнутая рендерится из неё). */
export async function writeYmPrices(
  rows: Array<{ offerId: string; value: number; discountBase?: number }>
): Promise<{ ok: number; errors: string[] }> {
  const errors: string[] = [];
  let ok = 0;
  for (let i = 0; i < rows.length; i += 500) {
    const batch = rows.slice(i, i + 500);
    try {
      await ymApiRequest(`/v2/businesses/${YM_BUSINESS}/offer-prices/updates`, 'POST', {
        offers: batch.map((x) => ({
          offerId: x.offerId,
          price: { value: x.value, currencyId: 'RUR', ...(x.discountBase ? { discountBase: x.discountBase } : {}) },
        })),
      });
      ok += batch.length;
    } catch (e) {
      errors.push(`ЯМ батч ${i}-${i + batch.length}: ${(e as Error).message.slice(0, 200)} [${batch.map((x) => x.offerId).join(',')}]`);
    }
  }
  return { ok, errors };
}

// ---------- Создание карточек ----------
export async function ozImport(items: any[]): Promise<string | null> {
  const r = await fetch(`${OZON_API_URL}/v3/product/import`, { method: 'POST', headers: createOzonHeaders(), body: JSON.stringify({ items }) });
  const j: any = await r.json().catch(() => ({}));
  return j.result?.task_id || null;
}
export async function ozImportInfo(taskId: string): Promise<any> {
  const r = await fetch(`${OZON_API_URL}/v1/product/import/info`, { method: 'POST', headers: createOzonHeaders(), body: JSON.stringify({ task_id: taskId }) });
  return r.json().catch(() => ({}));
}
export async function ymUpsertOffer(businessId: number, offer: any): Promise<any> {
  return ymApiRequest(`/v2/businesses/${businessId}/offer-mappings/update`, 'POST', { offerMappings: [{ offer }] });
}
export async function ymSetPrice(businessId: number, offerId: string, price: number, discountBase?: number): Promise<any> {
  return ymApiRequest(`/v2/businesses/${businessId}/offer-prices/updates`, 'POST', {
    offers: [{ offerId, price: { value: price, currencyId: 'RUR', ...(discountBase ? { discountBase } : {}) } }],
  });
}

// ---------- Заказы (общий сбор) ----------
export interface OrdersResult {
  orders: OpenOrder[];
  errors: Marketplace[]; // МП, по которым тянучка заказов упала (сбой сети/API)
}

/**
 * FBS-заказы WB через marketplace-api: GET /api/v3/orders (окно ≤30 дней за запрос, до 1000 на страницу)
 * + POST /api/v3/orders/status (статусы пачками ≤1000). Отменён = wbStatus canceled/canceled_by_client/
 * declined_by_client либо supplierStatus cancel. Цена — convertedPrice (копейки, со скидкой продавца) → ₽.
 */
async function listWbFbsOrders(daysWindow: number): Promise<OpenOrder[]> {
  const headers = { ...createWBHeaders(), 'Content-Type': 'application/json' };
  const base = WB_API_URLS.marketplace;
  // Лимит marketplace-api: 300/мин, интервал 200 мс, всплеск 20; ответ 4XX считается за 10 запросов.
  // Поэтому между вызовами пауза ≥300 мс, а пагинация — только при полной странице (next приходит всегда).
  const PACE_MS = 300;
  let calls = 0;
  const wbJson = async (url: string, init?: RequestInit): Promise<any> => {
    if (calls++ > 0) await new Promise((res) => setTimeout(res, PACE_MS));
    const r = await fetch(url, { ...init, headers });
    if (!r.ok) {
      const retry = r.headers.get('x-ratelimit-retry');
      throw new Error(`WB marketplace ${r.status}${retry ? ` (retry after ${retry}с)` : ''} ${url.replace(base, '').slice(0, 60)}: ${(await r.text()).slice(0, 120)}`);
    }
    return r.json();
  };
  const nowSec = Math.floor(Date.now() / 1000);
  const raw: any[] = [];
  // одно окно ≤30 календарных дней (максимум API одним запросом)
  const from = nowSec - Math.min(daysWindow, 30) * 86400;
  let next = 0;
  for (;;) {
    const page = await wbJson(`${base}/api/v3/orders?limit=1000&next=${next}&dateFrom=${from}&dateTo=${nowSec}`);
    const got: any[] = page.orders || [];
    raw.push(...got);
    next = Number(page.next) || 0;
    if (got.length < 1000 || !next) break;
  }
  const status = new Map<number, { s: string; w: string }>();
  for (let i = 0; i < raw.length; i += 1000) {
    const ids = raw.slice(i, i + 1000).map((o) => o.id);
    const st = await wbJson(`${base}/api/v3/orders/status`, { method: 'POST', body: JSON.stringify({ orders: ids }) });
    for (const s of st.orders || []) status.set(Number(s.id), { s: String(s.supplierStatus || ''), w: String(s.wbStatus || '') });
  }
  const out: OpenOrder[] = [];
  for (const o of raw) {
    const st = status.get(Number(o.id)) || { s: '', w: '' };
    const cancelled = st.s === 'cancel' || /^(canceled|canceled_by_client|declined_by_client)$/.test(st.w);
    const kop = Number(o.convertedPrice ?? o.price) || 0;
    for (const sku of o.skus || []) {
      out.push({
        mp: 'wb', orderId: `wb:${o.rid || o.id}:${sku}`, key: String(sku), qty: 1,
        status: `${st.s}/${st.w}`, consuming: !cancelled, price: kop ? Math.round(kop / 100) : undefined,
      });
    }
  }
  return out;
}

/** Собрать заказы (потребляющие + видимые отмены) по всем 3 МП за окно daysWindow, плоско по позициям. */
export async function collectOpenOrders(daysWindow = 30): Promise<OrdersResult> {
  const orders: OpenOrder[] = [];
  const errors: Marketplace[] = [];
  const dateFrom = daysAgoISO(daysWindow);

  try {
    // С 2026-09-04 — FBS-заказы из marketplace-api (лимит 300/мин), а НЕ statistics-api /supplier/orders:
    // у statistics лимит 1 запрос, и после 429 штрафное окно растёт (замерено 5226 → 6690 → 10504 с).
    // FBS-заказ = 1 единица; id — rid (уникален на сборочное задание).
    for (const o of await listWbFbsOrders(daysWindow)) orders.push(o);
  } catch (e) { errors.push('wb'); console.error(`[collectOpenOrders] wb: ${(e as Error).message.slice(0, 220)}`); }

  try {
    // Только FBS: FBO-запас лежит на складе Ozon и в сквозной пул не входит (см. listOzonOffers).
    // 2026-09-10: /v2/posting/fbo/list у Ozon залип в 429 (retry-after: 1, не отпускает) — весь тик падал из-за ненужного вызова.
    const oz: any = await ozGetOrders({ status: 'all', limit: 1000, scheme: 'fbs' });
    for (const o of oz.orders || []) {
      for (const it of o.items || []) {
        orders.push({
          mp: 'ozon', orderId: `ozon:${o.postingNumber}:${it.offerId}`, key: String(it.offerId),
          qty: Number(it.quantity) || 1, status: String(o.status), consuming: !isCancelled(o.status),
          price: Number(it.price) || undefined,
        });
      }
    }
  } catch (e) { errors.push('ozon'); console.error(`[collectOpenOrders] ozon: ${(e as Error).message.slice(0, 220)}`); }

  try {
    const ym: any = await ymGetOrders({ limit: 200 });
    for (const o of ym.orders || []) {
      for (const it of o.items || []) {
        orders.push({
          mp: 'ym', orderId: `ym:${o.id}:${it.offerId}`, key: String(it.offerId),
          qty: Number(it.quantity) || 1, status: String(o.status), consuming: !isCancelled(o.status),
          price: Number(it.price) || undefined,
        });
      }
    }
  } catch (e) { errors.push('ym'); console.error(`[collectOpenOrders] ym: ${(e as Error).message.slice(0, 220)}`); }

  return { orders, errors };
}
