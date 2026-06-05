/**
 * Слой доступа к данным трёх МП. Переиспользует собранные dist-функции MCP-серверов;
 * запись остатков — через нативные API (проверено харнессами): WB updateStocksFBS,
 * Ozon /v2/products/stocks, ЯМ PUT /v2/campaigns/{id}/offers/stocks.
 */
import { getProductsInStock } from '../../mcp/wb-mcp/dist/tools/products-in-stock.js';
import { updateStocksFBS, getSellerWarehouses } from '../../mcp/wb-mcp/dist/tools/inventory.js';
import { getOrders as wbGetOrders } from '../../mcp/wb-mcp/dist/tools/orders.js';
import { getStocks as ozGetStocks } from '../../mcp/ozon-mcp/dist/tools/stocks.js';
import { getOrders as ozGetOrders } from '../../mcp/ozon-mcp/dist/tools/orders.js';
import { createOzonHeaders, OZON_API_URL } from '../../mcp/ozon-mcp/dist/utils/auth.js';
import { getPrices as ozGetPrices } from '../../mcp/ozon-mcp/dist/tools/prices.js';
import { getStocks as ymGetStocks } from '../../mcp/ym-mcp/dist/tools/stocks.js';
import { getOrders as ymGetOrders } from '../../mcp/ym-mcp/dist/tools/orders.js';
import { getPrices as ymGetPrices } from '../../mcp/ym-mcp/dist/tools/prices.js';
import { apiRequest as ymApiRequest } from '../../mcp/ym-mcp/dist/api/client.js';

import { OZ_WAREHOUSE, YM_WAREHOUSE, YM_CAMPAIGN } from './config.js';
import type { Marketplace, OpenOrder } from './types.js';

const daysAgoISO = (n: number): string => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);
const isCancelled = (s: string): boolean => /cancel|отмен|reject|return|возврат/i.test(s || '');

// ---------- WB ----------
export interface WbItem {
  barcode: string;
  vendorCode: string;
  stock: number;
  category?: string;
  title?: string;
  finalPrice?: number;
  price?: number;
}

export async function listWbInStock(): Promise<WbItem[]> {
  const wb: any = await getProductsInStock({ minQuantity: 1 });
  return (wb.products || []).map((p: any) => ({
    barcode: String(p.barcode),
    vendorCode: String(p.vendorCode),
    stock: Number(p.stock) || 0,
    category: p.category,
    title: p.title,
    finalPrice: Number(p.finalPrice) || Number(p.price) || 0,
    price: Number(p.price) || 0,
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
  return (st.products || []).map((s: any) => ({
    key: String(s.offerId),
    available: (Number(s.totalFbo) || 0) + (Number(s.totalFbs) || 0),
  }));
}

export async function writeOzonStock(changes: Array<{ key: string; amount: number }>): Promise<{ ok: number; errors: string[] }> {
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
  const st: any = await ymGetStocks({ limit: 1000 });
  return (st.stocks || []).map((s: any) => ({ key: String(s.offerId), available: Number(s.available) || 0 }));
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
export async function listOzonPrices(): Promise<Map<string, number>> {
  const r: any = await ozGetPrices({ limit: 1000, visibility: 'ALL' });
  const rows = r.prices || r.items || [];
  const m = new Map<string, number>();
  for (const x of rows) {
    const key = String(x.offerId ?? x.offer_id ?? '');
    const raw = x.marketingSellerPrice ?? x.price ?? '';
    const v = Number(typeof raw === 'string' ? raw.replace(',', '.') : raw);
    if (key && Number.isFinite(v) && v > 0) m.set(key, v);
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
  return ymApiRequest(`/businesses/${businessId}/offer-prices/updates`, 'POST', {
    offers: [{ offerId, price: { value: price, currencyId: 'RUR', ...(discountBase ? { discountBase } : {}) } }],
  });
}

// ---------- Заказы (общий сбор) ----------
export interface OrdersResult {
  orders: OpenOrder[];
  errors: Marketplace[]; // МП, по которым тянучка заказов упала (сбой сети/API)
}

/** Собрать заказы (потребляющие + видимые отмены) по всем 3 МП за окно daysWindow, плоско по позициям. */
export async function collectOpenOrders(daysWindow = 30): Promise<OrdersResult> {
  const orders: OpenOrder[] = [];
  const errors: Marketplace[] = [];
  const dateFrom = daysAgoISO(daysWindow);

  try {
    const wb: any = await wbGetOrders({ dateFrom, limit: 1000 });
    for (const o of wb.orders || []) {
      const qty = Number(o.quantity) || 1;
      orders.push({
        mp: 'wb', orderId: `wb:${o.orderId}:${o.barcode}`, key: String(o.barcode),
        qty, status: String(o.status), consuming: !isCancelled(o.status),
        price: o.totalPrice ? Math.round(Number(o.totalPrice) / qty) : undefined,
      });
    }
  } catch { errors.push('wb'); }

  try {
    const oz: any = await ozGetOrders({ status: 'all', limit: 1000 });
    for (const o of oz.orders || []) {
      for (const it of o.items || []) {
        orders.push({
          mp: 'ozon', orderId: `ozon:${o.postingNumber}:${it.offerId}`, key: String(it.offerId),
          qty: Number(it.quantity) || 1, status: String(o.status), consuming: !isCancelled(o.status),
          price: Number(it.price) || undefined,
        });
      }
    }
  } catch { errors.push('ozon'); }

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
  } catch { errors.push('ym'); }

  return { orders, errors };
}
