/**
 * Каталог себестоимости (COGS) по barcode. Одна сумма на изделие (уникальный хендмейд).
 * Источник истины — data/state/costs.json (атомарная запись). Каждая правка — строка в costs-log.jsonl.
 */
import { readFileSync, writeFileSync, appendFileSync, mkdirSync, renameSync, existsSync } from 'node:fs';
import { dirname } from 'node:path';
import { COSTS_PATH, COSTS_LOG_PATH } from './config.js';

export interface CostEntry {
  cost: number; // себестоимость за единицу, ₽
  currency: string;
  note?: string;
  source?: string; // tg:<user> и т.п.
  updatedAt: string;
}

export interface CostsCatalog {
  _meta: { updated: string; version: number };
  items: Record<string, CostEntry>;
}

export function loadCosts(): CostsCatalog {
  if (existsSync(COSTS_PATH)) {
    try {
      return JSON.parse(readFileSync(COSTS_PATH, 'utf8')) as CostsCatalog;
    } catch {
      /* битый файл — пересоздадим */
    }
  }
  return { _meta: { updated: new Date().toISOString(), version: 1 }, items: {} };
}

export function saveCosts(c: CostsCatalog): void {
  c._meta.updated = new Date().toISOString();
  mkdirSync(dirname(COSTS_PATH), { recursive: true });
  const tmp = COSTS_PATH + '.tmp';
  writeFileSync(tmp, JSON.stringify(c, null, 2));
  renameSync(tmp, COSTS_PATH);
}

/** Установить себестоимость по barcode (+ запись в аудит-лог). Возвращает запись. */
export function setCost(
  catalog: CostsCatalog,
  barcode: string,
  cost: number,
  meta: { note?: string; source?: string } = {}
): CostEntry {
  const entry: CostEntry = {
    cost,
    currency: 'RUB',
    note: meta.note,
    source: meta.source,
    updatedAt: new Date().toISOString(),
  };
  catalog.items[barcode] = entry;
  try {
    mkdirSync(dirname(COSTS_LOG_PATH), { recursive: true });
    appendFileSync(COSTS_LOG_PATH, JSON.stringify({ barcode, ...entry }) + '\n');
  } catch {
    /* аудит-лог не критичен */
  }
  return entry;
}

/** Быстрая карта barcode -> cost для чтения в reconcile / order-loop / finance. */
export function costsMap(): Map<string, number> {
  const c = loadCosts();
  const m = new Map<string, number>();
  for (const [bc, e] of Object.entries(c.items)) {
    if (typeof e.cost === 'number' && e.cost > 0) m.set(bc, e.cost);
  }
  return m;
}
