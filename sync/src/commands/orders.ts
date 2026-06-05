/**
 * Подкоманда `orders` — быстрый order-loop (cron каждую минуту).
 * Тянет ТОЛЬКО заказы (лёгкий запрос, без полного каталога), ловит новые,
 * уменьшает остаток в пуле и пушит на все 3 МП, шлёт алерт в Telegram по каждому заказу.
 * Тяжёлый full-reconcile (пополнения/выравнивание) делает подкоманда `stocks`.
 */
import { collectOpenOrders, writeWbStock, writeOzonStock, writeYmStock } from '../clients.js';
import { loadLedger, saveLedger } from '../inventory.js';
import { pricing } from '../config.js';
import { log } from '../log.js';
import { notify, alertBlock } from '../notify.js';
import type { Marketplace } from '../types.js';

const MP_NAME: Record<Marketplace, string> = { wb: 'WB', ozon: 'Ozon', ym: 'ЯМ' };
const round10 = (n: number): number => Math.ceil(n / 10) * 10;
const rub = (n: number): string => Math.round(n).toLocaleString('ru-RU') + ' ₽';

interface OrderAlert {
  mp: Marketplace;
  title: string;
  bc: string;
  qty: number;
  newStock: number;
  buyerUnit: number; // цена покупателя за ед.
  sum: number; // сумма заказа
  ourUnit: number | null; // наша цена по правилу
  profit: number | null; // прибыль при выкупе (после комиссии)
  takePct: number | null; // комиссия %
}

export async function runOrders(apply: boolean): Promise<void> {
  const ledger = loadLedger();

  // резолв ключа заказа (offerId/barcode/vendorCode) в barcode пула
  const vendorToBarcode = new Map<string, string>();
  for (const [bc, e] of Object.entries(ledger.items)) if (e.vendorCode) vendorToBarcode.set(e.vendorCode, bc);
  const resolve = (k: string): string | null => (ledger.items[k] ? k : vendorToBarcode.get(k) ?? null);

  // окно 2 дня — заказы обрабатываются за минуты, незачем тянуть 30 дней
  const { orders, errors } = await collectOpenOrders(2);
  if (errors.length) {
    log(`🟡 order-loop: сбой тянучки заказов (${errors.join(', ')}) — пропуск тика`);
    return;
  }

  const affected = new Map<string, number>(); // barcode -> новый остаток
  const alerts: OrderAlert[] = [];
  let skippedUnseeded = 0;
  const bySubject = (pricing as any).by_subject || {};

  for (const o of orders) {
    if (!o.consuming) continue;
    const bc = resolve(o.key);
    if (!bc) {
      skippedUnseeded++;
      continue; // товара ещё нет в пуле — засеет ближайший full-reconcile
    }
    const e = ledger.items[bc];
    if (e.appliedOrders.includes(o.orderId)) continue; // уже учтён

    e.base = Math.max(0, e.base - o.qty);
    e.appliedOrders.push(o.orderId);
    e.wbBaseline = e.base;
    e.lastPushed = { wb: e.base, ozon: e.base, ym: e.base };
    e.updatedAt = new Date().toISOString();
    affected.set(bc, e.base);

    // экономика заказа: комиссия и k берём из категории (pricing.json)
    const pr = e.category ? bySubject[e.category] : null;
    const take: number | null = pr ? pr['take_' + o.mp] ?? null : null;
    const k: number | null = pr ? pr['k_' + o.mp] ?? null : null;
    const buyerUnit = o.price || 0;
    const sum = Math.round(buyerUnit * o.qty);
    const ourUnit = e.wbFinal ? (o.mp === 'wb' ? Math.round(e.wbFinal) : k ? round10(e.wbFinal * k) : null) : null;
    const profit = take != null && sum ? Math.round(sum * (1 - take)) : null;
    alerts.push({ mp: o.mp, title: e.title || bc, bc, qty: o.qty, newStock: e.base, buyerUnit, sum, ourUnit, profit, takePct: take != null ? Math.round(take * 100) : null });
  }

  if (!alerts.length) {
    log(`order-loop: новых заказов нет${skippedUnseeded ? ` (вне пула: ${skippedUnseeded})` : ''}`);
    return;
  }
  log(`order-loop: новых заказов ${alerts.length}`);

  if (!apply) {
    for (const a of alerts) log(`  [dry] ${MP_NAME[a.mp]} ${a.bc} −${a.qty} → ${a.newStock}`);
    log('dry-run: не применяю, леджер не сохранён');
    return;
  }

  // пуш нового остатка на все 3 МП (ключ оффера = barcode)
  const changes = [...affected].map(([key, amount]) => ({ key, amount }));
  await writeWbStock(changes);
  await writeOzonStock(changes);
  await writeYmStock(changes);
  saveLedger(ledger);
  log(`order-loop: применено по ${changes.length} товарам`);

  // алерт по каждому заказу
  for (const a of alerts) {
    const lines = [`${a.title} (${a.bc})`, `Заказано: ${a.qty} шт`];
    if (a.buyerUnit) {
      const ourNote = a.ourUnit && a.ourUnit !== a.buyerUnit ? ` (наша по правилу: ${rub(a.ourUnit)})` : '';
      lines.push(`Цена покупателя: ${rub(a.buyerUnit)}${ourNote}`);
      lines.push(`Сумма заказа: ${rub(a.sum)}`);
    }
    if (a.profit != null) lines.push(`Прибыль при выкупе ≈ ${rub(a.profit)} (комиссия ~${a.takePct}%)`);
    else lines.push('Прибыль: категория/цена не определены (досчитается после reconcile)');
    lines.push(`Новый остаток пула: ${a.newStock}`);
    lines.push(`Синхронизировано: WB ${a.newStock} · Ozon ${a.newStock} · ЯМ ${a.newStock}`);
    await notify(alertBlock(`🛒 Заказ · ${MP_NAME[a.mp]}`, lines));
  }
}
