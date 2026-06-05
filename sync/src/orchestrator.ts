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
import { log } from './log.js';
import { notify, alertBlock } from './notify.js';

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
    default:
      console.log('Использование: sellerai-sync <orders|stocks|cards|prices|reconcile> [--apply]');
      process.exit(cmd ? 1 : 0);
  }
}

main().catch(async (e: unknown) => {
  const err = e as Error;
  log('💥 FATAL: ' + (err.stack || err.message));
  await notify(alertBlock('💥 SellerAI sync FATAL', [String(err.message)]));
  process.exit(1);
});
