/**
 * Подкоманда `finance` — P&L по продажам за окно (по умолчанию 30 дней).
 * По каждому проданному заказу: выручка − комиссия(категория) − себестоимость(costs.json).
 * Агрегирует и шлёт сводку в Telegram. Без мутаций.
 */
import { collectOpenOrders } from '../clients.js';
import { loadLedger } from '../inventory.js';
import { costsMap } from '../costs.js';
import { pricing } from '../config.js';
import { log } from '../log.js';
import { notify, alertBlock } from '../notify.js';

const rub = (n: number): string => Math.round(n).toLocaleString('ru-RU') + ' ₽';
// Фактическая all-in нагрузка (комиссия + КВВ/эквайринг + логистика) — сверка 2026-06-15 (60 дн):
//   WB   36% = номин. комиссия 31.5% + КВВ/эквайринг ~2.6% + логистика 1.7%
//   Ozon 56% = комиссия 53.2% + услуги/логистика 3.0%
// Для WB/Ozon берём эти ставки (заменяют commission-only из pricing.json, который ровнял маржу для k-цен).
// ЯМ факт недоступен в MCP → остаётся per-category take_ym из pricing.json (там уже FEE + ~7% all-in).
const EFFECTIVE_TAKE: Record<string, number> = { wb: 0.36, ozon: 0.56 };
// фолбэк, если категория не определена — чтобы не завышать прибыль
const DEFAULT_TAKE: Record<string, number> = { wb: 0.36, ozon: 0.56, ym: 0.53 };

export async function runFinance(days = 30): Promise<void> {
  log(`=== finance (P&L, ${days} дн) ===`);
  const { orders, errors } = await collectOpenOrders(days);
  const ledger = loadLedger();
  const costs = costsMap();
  const by = (pricing as any).by_subject || {};

  const vendorToBarcode = new Map<string, string>();
  for (const [bc, e] of Object.entries(ledger.items)) if (e.vendorCode) vendorToBarcode.set(e.vendorCode, bc);
  const resolve = (k: string): string | null => (ledger.items[k] ? k : vendorToBarcode.get(k) ?? null);

  let revenue = 0;
  let commission = 0;
  let cogs = 0;
  let sales = 0;
  let noCost = 0;
  const byCat = new Map<string, { rev: number; prof: number; n: number }>();
  const items: Array<{ title: string; profit: number }> = [];

  for (const o of orders) {
    if (!o.consuming) continue;
    const bc = resolve(o.key);
    if (!bc) continue;
    const e = ledger.items[bc];
    const cat = e?.category || '(без категории)';
    const pr = by[cat];
    const take: number = EFFECTIVE_TAKE[o.mp] ?? (pr ? pr['take_' + o.mp] : null) ?? DEFAULT_TAKE[o.mp] ?? 0;
    const rev = (o.price || 0) * o.qty;
    const comm = rev * take;
    const cost = costs.get(bc) ?? e?.cost ?? null;
    const cg = cost != null ? cost * o.qty : 0;
    if (cost == null) noCost++;
    const profit = rev - comm - cg;

    revenue += rev;
    commission += comm;
    cogs += cg;
    sales++;
    items.push({ title: e?.title || bc, profit });
    const c = byCat.get(cat) || { rev: 0, prof: 0, n: 0 };
    c.rev += rev;
    c.prof += profit;
    c.n++;
    byCat.set(cat, c);
  }

  const net = revenue - commission - cogs;
  const margin = revenue ? Math.round((net / revenue) * 100) : 0;
  items.sort((a, b) => b.profit - a.profit);

  const lines = [
    `Период: ${days} дн · продаж: ${sales}`,
    `Выручка: ${rub(revenue)}`,
    `− Комиссии МП: ${rub(commission)}`,
    `− Себестоимость: ${rub(cogs)}${noCost ? ` (без COGS: ${noCost} поз.)` : ''}`,
    `= Чистая прибыль: ${rub(net)} (маржа ${margin}%)`,
  ];
  if (byCat.size) {
    lines.push('', 'По категориям:');
    for (const [c, v] of [...byCat.entries()].sort((a, b) => b[1].prof - a[1].prof)) lines.push(`  ${c}: ${rub(v.prof)} (${v.n} прод.)`);
  }
  if (items.length) {
    lines.push('', 'Топ прибыльных:');
    for (const it of items.slice(0, 3)) lines.push(`  +${rub(it.profit)} ${it.title.slice(0, 28)}`);
  }
  if (errors.length) lines.push('', `⚠ сбой тянучки: ${errors.join(', ')}`);

  log(lines.join(' | '));
  await notify(alertBlock('📊 P&L · чистая прибыль', lines));
}
