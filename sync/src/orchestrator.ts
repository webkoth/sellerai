#!/usr/bin/env node
/**
 * CLI авто-синхронизации. Запуск из cron: node dist/orchestrator.js <cmd> [--apply]
 *   stocks     — сквозная синхронизация остатков (по умолчанию dry-run, --apply применяет)
 *   cards      — авто-создание недостающих карточек (in-stock WB без карточки)
 *   prices     — отчёт по дрейфу цен (режим A vs факт), без мутаций
 *   reconcile  — health-сводка в Telegram
 */
import { runStocks } from './commands/stocks.js';
import { runOrders } from './commands/orders.js';
import { runCards } from './commands/cards.js';
import { runPrices } from './commands/prices.js';
import { runReconcile } from './commands/reconcile.js';
import { runIntake } from './commands/intake.js';
import { runFinance } from './commands/finance.js';
import { log } from './log.js';
import { notify, alertBlock } from './notify.js';
import { throttled } from './monitor.js';

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const cmd = argv[0];
  const apply = argv.includes('--apply');

  switch (cmd) {
    case 'orders':
      await runOrders(apply);
      break;
    case 'stocks':
      await runStocks(apply);
      break;
    case 'cards':
      await runCards(apply);
      break;
    case 'prices':
      await runPrices();
      break;
    case 'reconcile':
      await runReconcile();
      break;
    case 'intake':
      await runIntake();
      break;
    case 'finance':
      await runFinance(Number(argv[1]) || 30);
      break;
    default:
      console.log('Использование: sellerai-sync <orders|stocks|cards|prices|reconcile|intake|finance> [--apply]');
      process.exit(cmd ? 1 : 0);
  }
}

main().catch(async (e: unknown) => {
  const err = e as Error;
  log('💥 FATAL: ' + (err.stack || err.message));
  // Throttle: при затяжном сбое (например, 500 WB часами) подкоманды падают
  // каждый крон-тик (stocks — раз в 30 мин). Шлём FATAL-алерт по сигнатуре ошибки
  // не чаще раза в 2 часа (окно > интервала крона, иначе не подавляется на границе).
  // Первый инцидент уходит сразу; повторы той же ошибки — тихо в лог.
  const cmd = process.argv[2] || '?';
  const sig = `fatal:${cmd}:${err.message.slice(0, 80)}`;
  if (!throttled(sig, 120 * 60 * 1000)) {
    await notify(alertBlock('💥 SellerAI sync FATAL', [`[${cmd}] ${err.message}`]));
  } else {
    log('[throttle] FATAL-алерт подавлен (уже отправлялся <30 мин назад)');
  }
  process.exit(1);
});
