/**
 * Файловый логгер с посуточным файлом logs/sync-ГГГГММДД.log.
 */
import { appendFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { LOG_DIR } from './config.js';

function todayFile(): string {
  const d = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  return resolve(LOG_DIR, `sync-${d}.log`);
}

export function log(msg: string): void {
  const line = `[${new Date().toISOString()}] ${msg}`;
  console.log(line);
  try {
    mkdirSync(LOG_DIR, { recursive: true });
    appendFileSync(todayFile(), line + '\n');
  } catch {
    /* лог не должен ронять синк */
  }
}
