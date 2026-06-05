/**
 * Подкоманда `intake` — приёмка себестоимости через Telegram (cron каждую минуту).
 * Опрашивает getUpdates, парсит «/cost <barcode> <сумма> [заметка]», пишет в costs.json,
 * отвечает подтверждением + прогнозом прибыли по МП. Offset хранится в data/state/tg-offset.json.
 *
 * Латинская команда /cost (алиасы /c, /себес) ловится при privacy ON. Один потребитель getUpdates — только intake.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { getUpdates, reply, alertBlock } from '../notify.js';
import { loadCosts, saveCosts, setCost } from '../costs.js';
import { loadLedger } from '../inventory.js';
import { pricing, TG_OFFSET_PATH } from '../config.js';
import { log } from '../log.js';

const round10 = (n: number): number => Math.ceil(n / 10) * 10;
const rub = (n: number): string => Math.round(n).toLocaleString('ru-RU') + ' ₽';
const CMD = /^\/(?:cost|c|себес)(?:@\w+)?\s+(\S+)\s+(\d+(?:[.,]\d+)?)\s*(.*)$/i;

function loadOffset(): number {
  try {
    return Number(JSON.parse(readFileSync(TG_OFFSET_PATH, 'utf8')).offset) || 0;
  } catch {
    return 0;
  }
}
function saveOffset(o: number): void {
  try {
    mkdirSync(dirname(TG_OFFSET_PATH), { recursive: true });
    writeFileSync(TG_OFFSET_PATH, JSON.stringify({ offset: o }));
  } catch {
    /* не критично */
  }
}

/** Прогноз прибыли при выкупе по каждому МП = режим-A цена − комиссия − себестоимость. */
function forecast(barcode: string, cost: number): string[] {
  const e = loadLedger().items[barcode];
  if (!e || !e.wbFinal || !e.category) return ['(карточка ещё не в пуле — прибыль посчитается после /sync и reconcile)'];
  const pr = (pricing as any).by_subject[e.category];
  if (!pr) return [`категория «${e.category}» без коэффициентов`];
  const rows = [
    { name: 'WB', price: Math.round(e.wbFinal), take: pr.take_wb as number },
    { name: 'Ozon', price: round10(e.wbFinal * (pr.k_ozon || 1)), take: pr.take_ozon as number },
    { name: 'ЯМ', price: round10(e.wbFinal * (pr.k_ym || 1)), take: pr.take_ym as number },
  ];
  return rows
    .filter((r) => r.take != null)
    .map((r) => {
      const profit = Math.round(r.price * (1 - r.take) - cost);
      const margin = r.price ? Math.round((profit / r.price) * 100) : 0;
      return `${r.name} ${rub(r.price)}: −${Math.round(r.take * 100)}% −себест = ${rub(profit)} (${margin}%)`;
    });
}

export async function runIntake(): Promise<void> {
  const offset = loadOffset();
  const updates = await getUpdates(offset);
  if (!updates.length) return;

  const catalog = loadCosts();
  let maxId = offset;
  let changed = false;

  for (const u of updates) {
    maxId = Math.max(maxId, u.updateId + 1);
    const m = CMD.exec((u.text || '').trim());
    if (!m) continue;

    const barcode = m[1];
    const cost = Math.round(Number(m[2].replace(',', '.')));
    const note = (m[3] || '').trim() || undefined;
    if (!cost || cost <= 0) {
      await reply(u.chatId, `⚠ Не понял сумму. Формат: <code>/cost ${barcode} 5000 заметка</code>`);
      continue;
    }
    setCost(catalog, barcode, cost, { note, source: 'tg:' + u.from });
    changed = true;
    log(`intake: cost ${barcode} = ${cost} (от ${u.from})`);
    await reply(
      u.chatId,
      alertBlock('✅ Себестоимость учтена', [`${barcode}: ${rub(cost)}${note ? ' · ' + note : ''}`, 'Прогноз прибыли при выкупе:', ...forecast(barcode, cost)])
    );
  }

  if (changed) saveCosts(catalog);
  if (maxId > offset) saveOffset(maxId);
}
