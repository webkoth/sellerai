/**
 * Загрузка конфигурации: .env + мэппинги. Корень репозитория вычисляется от dist/.
 */
import { config as dotenvConfig } from 'dotenv';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url)); // .../sync/dist
export const ROOT = resolve(here, '../..'); // корень репозитория

dotenvConfig({ path: resolve(ROOT, '.env') });

const loadJson = (rel: string): any => JSON.parse(readFileSync(resolve(ROOT, rel), 'utf8'));

export const syncConfig = loadJson('data/mappings/sync-config.json');
export const categoryMap = loadJson('data/mappings/category-map.json');
export const pricing = loadJson('data/mappings/pricing.json');

// Telegram
export const TELEGRAM_TOKEN: string = process.env.TELEGRAM_BOT_TOKEN || '';
export const TELEGRAM_CHAT: number | string | undefined = syncConfig.telegram?.chat_id;

// Склады/идентификаторы площадок
export const OZ_WAREHOUSE: number = syncConfig.ozon.fbs_warehouse_id;
export const YM_WAREHOUSE: number = syncConfig.ym.warehouse_id;
export const YM_CAMPAIGN: number = syncConfig.ym.campaign_id;
export const YM_BUSINESS: number = syncConfig.ym.business_id;

// Параметры синка
export const SYNC = syncConfig.sync;
export const GUARD = syncConfig.sync.guardrails;
export const CROSS_MARKETPLACE: boolean = !!syncConfig.sync.cross_marketplace;

// Пути состояния
export const STATE_DIR = resolve(ROOT, 'data/state');
export const LEDGER_PATH = resolve(STATE_DIR, 'inventory.json');
export const COSTS_PATH = resolve(STATE_DIR, 'costs.json');
export const COSTS_LOG_PATH = resolve(STATE_DIR, 'costs-log.jsonl');
export const TG_OFFSET_PATH = resolve(STATE_DIR, 'tg-offset.json');
export const LOG_DIR = resolve(ROOT, 'logs');
