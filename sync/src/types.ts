/**
 * Общие типы слоя авто-синхронизации.
 */

export type Marketplace = 'wb' | 'ozon' | 'ym';

/** Текущий остаток оффера на площадке (ключ — barcode). */
export interface PlatformStock {
  mp: Marketplace;
  key: string; // offerId/barcode на площадке
  available: number; // продаваемый остаток
  frozen?: number; // зарезервировано под заказы (YM FREEZE и т.п.)
}

/** Открытый заказ — резервирует физическую единицу из общего пула. */
export interface OpenOrder {
  mp: Marketplace;
  orderId: string; // уникальный id заказа (для идемпотентности)
  key: string; // barcode/offerId для джойна с пулом
  qty: number;
  status: string;
  consuming: boolean; // true — заказ держит единицу (не отменён)
  price?: number; // цена покупателя за единицу (для суммы заказа и расчёта прибыли)
}

/** Запись леджера на один физический товар (ключ — barcode WB). */
export interface LedgerEntry {
  base: number; // физический остаток — источник истины
  wbBaseline: number; // что мы последний раз выставили на WB (детект пополнения)
  appliedOrders: string[]; // id заказов, уже вычтенных из base (идемпотентность)
  lastPushed: { wb?: number; ozon?: number; ym?: number };
  title?: string;
  vendorCode?: string;
  category?: string; // WB subjectName — для комиссии и k при расчёте прибыли
  wbFinal?: number; // WB_final (эталон) — для «нашей цены» по правилу
  updatedAt: string;
}

export interface Ledger {
  _meta: { updated: string; version: number };
  items: Record<string, LedgerEntry>; // ключ = barcode
}

/** Одно изменение остатка к применению (БЫЛО→СТАЛО). */
export interface StockChange {
  mp: Marketplace;
  key: string;
  was: number;
  becomes: number;
  title?: string;
}
