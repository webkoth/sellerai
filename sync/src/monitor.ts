/**
 * Мониторинг живости синка: heartbeat-детектор простоя + throttle алертов.
 *
 * heartbeat: order-loop бьёт каждую минуту. Если между двумя ударами прошло
 * больше порога — значит цикл стоял (сервер выключен / крон снят / node падал).
 * Детект срабатывает на первом же тике после восстановления и шлёт один алерт.
 *
 * throttle: не спамить одинаковыми алертами (например, при затяжном 500 WB
 * подкоманды падают каждые 30 мин — FATAL должен уйти раз в cooldown, не каждый раз).
 */
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { STATE_DIR } from './config.js';

const HEARTBEAT_PATH = resolve(STATE_DIR, 'heartbeat.json');
const THROTTLE_PATH = resolve(STATE_DIR, 'alert-throttle.json');

function readJson<T>(path: string, fallback: T): T {
  if (!existsSync(path)) return fallback;
  try {
    return JSON.parse(readFileSync(path, 'utf8')) as T;
  } catch {
    return fallback;
  }
}

function writeJson(path: string, data: unknown): void {
  mkdirSync(STATE_DIR, { recursive: true });
  writeFileSync(path, JSON.stringify(data));
}

/**
 * Отметить удар heartbeat и вернуть простой (в минутах) с предыдущего удара.
 * null — первый запуск (файла ещё нет), простоя измерить не с чем.
 */
export function beat(): number | null {
  const prev = readJson<{ ts?: number }>(HEARTBEAT_PATH, {});
  const now = Date.now();
  writeJson(HEARTBEAT_PATH, { ts: now, iso: new Date(now).toISOString() });
  if (typeof prev.ts !== 'number') return null;
  return (now - prev.ts) / 60000;
}

/**
 * true — алерт с этим ключом уже уходил в пределах cooldown (подавить).
 * false — можно слать; факт отправки фиксируется (обновляет метку времени ключа).
 */
export function throttled(key: string, cooldownMs: number): boolean {
  const store = readJson<Record<string, number>>(THROTTLE_PATH, {});
  const now = Date.now();
  const last = store[key];
  if (typeof last === 'number' && now - last < cooldownMs) return true;
  store[key] = now;
  // подчистка протухших ключей, чтобы файл не рос
  for (const k of Object.keys(store)) {
    if (now - store[k] > 24 * 60 * 60 * 1000) delete store[k];
  }
  writeJson(THROTTLE_PATH, store);
  return false;
}
