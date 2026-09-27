/**
 * Яндекс KIT (свой магазин kit42191) — четвёртая площадка старого синка.
 * Заплатка до перехода на sync2 (решение 26.09.2026): без неё заказ KIT не снимал
 * единицу с WB/Ozon/ЯМ, а остаток KIT правился только ручным скриптом.
 *
 * API: https://api.kit.yandex.net, Bearer YAKIT_API_TOKEN. Запросы строго по одному:
 * при параллельных сервер рвёт соединение. Остаток пишется абсолютным числом через
 * POST /v1/variants/stocks/bulk_update (атомарно, до 5000 позиций).
 */
import type { OpenOrder } from './types.js';

const KIT_API = 'https://api.kit.yandex.net';
/** «Склад Краснодар» (base_warehouse) — единственный склад продаж KIT, как в scripts/kit_sync_stocks.py. */
export const KIT_WAREHOUSE = '01980d4c-1b53-7aa1-ab23-1b7c23604704';
/** Отмена до передачи покупателю — единица возвращается в пул. Возвраты (FULL_REFUND и т.п.) — нет: товар едет назад. */
const KIT_CANCELLED = new Set(['CANCELLED', 'DELIVERY_CANCELLED']);
const PACE_MS = 1100;

let lastCall = 0;
async function kit(method: 'GET' | 'POST', path: string, body?: unknown): Promise<any> {
  const token = process.env.YAKIT_API_TOKEN;
  if (!token) throw new Error('YAKIT_API_TOKEN не задан в .env');
  for (let attempt = 0; attempt < 4; attempt++) {
    const wait = lastCall + PACE_MS - Date.now();
    if (wait > 0) await new Promise((res) => setTimeout(res, wait));
    lastCall = Date.now();
    const r = await fetch(KIT_API + path, {
      method,
      headers: { Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    }).catch((e: Error) => ({ ok: false, status: 0, text: async () => e.message }) as unknown as Response);
    if (r.ok) {
      const text = await r.text();
      return text ? JSON.parse(text) : {};
    }
    if ([0, 429, 500, 502, 503, 504].includes(r.status) && attempt < 3) {
      await new Promise((res) => setTimeout(res, 2000 * (attempt + 1)));
      continue;
    }
    throw new Error(`KIT ${method} ${path} ${r.status}: ${(await r.text()).slice(0, 160)}`);
  }
  throw new Error(`KIT ${method} ${path}: нет ответа`);
}

export interface KitVariant {
  id: string;
  barcode: string;
  /** Остаток на складе продаж. */
  stock: number;
}

/** Все варианты магазина со штрихкодом. Без total_count — листаем до неполной страницы. */
export async function listKitVariants(): Promise<KitVariant[]> {
  const out: KitVariant[] = [];
  for (let page = 1; ; page++) {
    const d = await kit('GET', `/v1/variants?per_page=100&page=${page}`);
    const got: any[] = d.variants || [];
    for (const v of got) {
      const barcode = String(v.barcode || '');
      if (!barcode) continue;
      const stock = (v.stocks || [])
        .filter((s: any) => s.warehouse_id === KIT_WAREHOUSE)
        .reduce((sum: number, s: any) => sum + (Number(s.quantity) || 0), 0);
      out.push({ id: String(v.id), barcode, stock });
    }
    if (got.length < 100) return out;
  }
}

/** Остатки KIT для сверки: ключ — штрихкод WB (в KIT варианты заведены с баркодами WB). */
export async function listKitOffers(variants?: KitVariant[]): Promise<Array<{ key: string; available: number }>> {
  return (variants ?? (await listKitVariants())).map((v) => ({ key: v.barcode, available: v.stock }));
}

/**
 * Запись остатков KIT. Ключ — штрихкод; неизвестный штрихкод (или артикул, который
 * order-loop шлёт вторым ключом для Ozon/ЯМ) пропускается без ошибки.
 */
export async function writeKitStock(
  changes: Array<{ key: string; amount: number }>,
  variants?: KitVariant[],
): Promise<{ ok: number; skipped: string[] }> {
  if (!changes.length) return { ok: 0, skipped: [] };
  const byBarcode = new Map((variants ?? (await listKitVariants())).map((v) => [v.barcode, v.id]));
  const items: Array<{ variant_id: string; warehouse_id: string; quantity: number }> = [];
  const skipped: string[] = [];
  for (const c of changes) {
    const id = byBarcode.get(c.key);
    if (!id) {
      skipped.push(c.key);
      continue;
    }
    items.push({ variant_id: id, warehouse_id: KIT_WAREHOUSE, quantity: Math.max(0, c.amount) });
  }
  if (items.length) await kit('POST', '/v1/variants/stocks/bulk_update', { items });
  return { ok: items.length, skipped };
}

/** Заказы KIT за окно дней, плоско по позициям; позиция → штрихкод через варианты. */
export async function listKitOrders(daysWindow: number, variants?: KitVariant[]): Promise<OpenOrder[]> {
  const barcodeOf = new Map((variants ?? (await listKitVariants())).map((v) => [v.id, v.barcode]));
  const since = Date.now() - daysWindow * 86400000;
  const out: OpenOrder[] = [];
  for (let page = 1; ; page++) {
    const d = await kit('GET', `/v1/orders?per_page=100&page=${page}`);
    const got: any[] = d.orders || [];
    for (const o of got) {
      if (Date.parse(o.created_at) < since) continue;
      const status = String(o.status || '');
      for (const ch of o.delivery_chunks || []) {
        for (const it of ch.items || []) {
          const barcode = barcodeOf.get(String(it.product_variant_id));
          if (!barcode) {
            console.error(`[kit] заказ ${o.order_number}: вариант ${it.product_variant_id} без штрихкода — позиция пропущена`);
            continue;
          }
          out.push({
            mp: 'kit',
            orderId: `kit:${o.id}:${it.id}`,
            key: barcode,
            qty: Number(it.quantity) || 1,
            status,
            consuming: !KIT_CANCELLED.has(status),
            price: Number(it.final_price) || undefined,
          });
        }
      }
    }
    if (got.length < 100) return out;
  }
}
