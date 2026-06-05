/**
 * Движок сквозного пула остатков.
 *
 * Единая модель реконсиляции (на каждый barcode):
 *   base' = base + (WB_сток − wbBaseline)            // WB-сигнал: продажи WB + пополнение + ручное снятие
 *               − Σ(новые потребляющие заказы Ozon/ЯМ)
 *               + Σ(видимые отмены Ozon/ЯМ ранее учтённых)
 *   available = max(0, base'),  затем wbBaseline = available (мы выставляем WB = available).
 *
 * WB-заказы ОТДЕЛЬНО не вычитаем — они уже отражены в падении WB-стока (иначе двойной учёт).
 * Холодный старт нового товара: base = WB_сток − (открытые заказы Ozon/ЯМ), все текущие заказы помечаются учтёнными.
 */
import { readFileSync, writeFileSync, mkdirSync, renameSync, existsSync } from 'node:fs';
import { dirname } from 'node:path';
import { LEDGER_PATH } from './config.js';
import { costsMap } from './costs.js';
import type { Ledger, OpenOrder } from './types.js';
import type { WbItem } from './clients.js';

const MAX_APPLIED = 500; // ограничение роста истории заказов на запись

export function loadLedger(): Ledger {
  if (existsSync(LEDGER_PATH)) {
    try {
      return JSON.parse(readFileSync(LEDGER_PATH, 'utf8')) as Ledger;
    } catch {
      /* битый файл — пересоздадим */
    }
  }
  return { _meta: { updated: new Date().toISOString(), version: 1 }, items: {} };
}

export function saveLedger(l: Ledger): void {
  l._meta.updated = new Date().toISOString();
  mkdirSync(dirname(LEDGER_PATH), { recursive: true });
  const tmp = LEDGER_PATH + '.tmp';
  writeFileSync(tmp, JSON.stringify(l, null, 2));
  renameSync(tmp, LEDGER_PATH);
}

export interface ReconcileResult {
  available: Map<string, number>; // barcode -> доступно (целевой остаток для всех 3 МП)
  events: string[];
  seeded: number;
}

export function reconcile(ledger: Ledger, wbItems: WbItem[], orders: OpenOrder[]): ReconcileResult {
  const events: string[] = [];
  let seeded = 0;

  const wbStock = new Map<string, number>();
  const vendorToBarcode = new Map<string, string>();
  const titleOf = new Map<string, string>();
  const vendorOf = new Map<string, string>();
  const catOf = new Map<string, string>();
  const finalOf = new Map<string, number>();
  const costs = costsMap();
  for (const it of wbItems) {
    wbStock.set(it.barcode, it.stock);
    if (it.vendorCode) {
      vendorToBarcode.set(it.vendorCode, it.barcode);
      vendorOf.set(it.barcode, it.vendorCode);
    }
    if (it.title) titleOf.set(it.barcode, it.title);
    if (it.category) catOf.set(it.barcode, it.category);
    if (it.finalPrice) finalOf.set(it.barcode, it.finalPrice);
  }
  // подмешиваем известное из леджера (товары, временно ушедшие из наличия)
  for (const [bc, e] of Object.entries(ledger.items)) {
    if (e.vendorCode) vendorToBarcode.set(e.vendorCode, bc);
  }

  const knownBarcode = new Set<string>([...wbStock.keys(), ...Object.keys(ledger.items)]);
  const resolveKey = (k: string): string | null => (knownBarcode.has(k) ? k : vendorToBarcode.get(k) || null);

  // индекс заказов Ozon/ЯМ по barcode. WB-заказы влияют через WB-дельту, но их id
  // помечаем учтёнными (wbByBc), чтобы быстрый order-loop не задвоил то же WB-уменьшение.
  const consumingByBc = new Map<string, OpenOrder[]>();
  const cancelledByBc = new Map<string, OpenOrder[]>();
  const wbByBc = new Map<string, OpenOrder[]>();
  for (const o of orders) {
    const bc = resolveKey(o.key);
    if (!bc) continue;
    if (o.mp === 'wb') {
      if (o.consuming) {
        const a = wbByBc.get(bc) || [];
        a.push(o);
        wbByBc.set(bc, a);
      }
      continue;
    }
    const map = o.consuming ? consumingByBc : cancelledByBc;
    const arr = map.get(bc) || [];
    arr.push(o);
    map.set(bc, arr);
  }

  const all = new Set<string>([...knownBarcode, ...consumingByBc.keys(), ...cancelledByBc.keys(), ...wbByBc.keys()]);
  const available = new Map<string, number>();
  const now = new Date().toISOString();

  for (const bc of all) {
    const curWb = wbStock.get(bc) ?? 0;
    const consuming = consumingByBc.get(bc) || [];
    const cancelled = cancelledByBc.get(bc) || [];
    let e = ledger.items[bc];

    if (!e) {
      // холодный старт записи
      const openOther = consuming.reduce((s, o) => s + o.qty, 0);
      const base = Math.max(0, curWb - openOther);
      e = {
        base,
        wbBaseline: base,
        appliedOrders: [...consuming.map((o) => o.orderId), ...(wbByBc.get(bc) || []).map((o) => o.orderId)],
        lastPushed: {},
        title: titleOf.get(bc),
        vendorCode: vendorOf.get(bc),
        category: catOf.get(bc),
        wbFinal: finalOf.get(bc),
        cost: costs.get(bc),
        updatedAt: now,
      };
      ledger.items[bc] = e;
      available.set(bc, base);
      seeded++;
      if (openOther > 0) events.push(`seed ${bc} base=${base} (WB ${curWb} − резерв ${openOther})`);
      continue;
    }

    // 1) WB-сигнал
    const wbDelta = curWb - e.wbBaseline;
    if (wbDelta !== 0) {
      e.base += wbDelta;
      events.push(`${bc} WB-дельта ${wbDelta > 0 ? '+' : ''}${wbDelta}`);
    }
    // 2) новые потребляющие заказы Ozon/ЯМ
    for (const o of consuming) {
      if (!e.appliedOrders.includes(o.orderId)) {
        e.base -= o.qty;
        e.appliedOrders.push(o.orderId);
        events.push(`заказ ${o.mp} ${bc} −${o.qty}`);
      }
    }
    // 3) видимые отмены ранее учтённых
    for (const o of cancelled) {
      const idx = e.appliedOrders.indexOf(o.orderId);
      if (idx >= 0) {
        e.base += o.qty;
        e.appliedOrders.splice(idx, 1);
        events.push(`отмена ${o.mp} ${bc} +${o.qty}`);
      }
    }

    // WB-заказы помечаем учтёнными (base уже скорректирован WB-дельтой) — защита от задвоения order-loop'ом
    for (const o of wbByBc.get(bc) || []) if (!e.appliedOrders.includes(o.orderId)) e.appliedOrders.push(o.orderId);

    e.base = Math.max(0, e.base);
    if (e.appliedOrders.length > MAX_APPLIED) e.appliedOrders = e.appliedOrders.slice(-MAX_APPLIED);
    if (catOf.has(bc)) e.category = catOf.get(bc);
    if (finalOf.has(bc)) e.wbFinal = finalOf.get(bc);
    if (costs.has(bc)) e.cost = costs.get(bc);
    e.wbBaseline = e.base; // мы выставим WB = base
    e.updatedAt = now;
    available.set(bc, e.base);
  }

  return { available, events, seeded };
}
