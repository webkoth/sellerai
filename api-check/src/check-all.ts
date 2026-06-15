/**
 * Проверка всех трёх маркетплейсов за один прогон.
 *
 * Запуск:
 *   npm run all                  — все пробы по WB / Ozon / ЯМ
 *   npm run all -- --full        — полные примеры
 *   npm run all -- --only prices — например, только цены по всем МП
 *   npm run all -- --quiet       — компактно, только статусы
 *
 * Код выхода: 0 — все пробы прошли, 1 — были ошибки (удобно для CI/cron).
 */

import { applyExitCode, c, installProxy, loadEnv, parseFlags, printHeader, runSuite, type ProbeResult } from './lib.ts';
import { wbProbes, WB_TITLE } from './check-wb.ts';
import { ozonProbes, OZON_TITLE } from './check-ozon.ts';
import { ymProbes, YM_TITLE } from './check-ym.ts';

async function main(): Promise<void> {
  const envPath = loadEnv();
  const proxy = await installProxy().catch((e: any) => {
    console.log(c.yellow(`прокси не поднялся: ${e?.message || e}`));
    return null;
  });
  printHeader(envPath, proxy);
  const flags = parseFlags();

  const all: ProbeResult[] = [];

  // Каждый набор оборачиваем в try, чтобы отсутствие токенов одного МП
  // не валило проверку остальных.
  for (const [title, build] of [
    [WB_TITLE, wbProbes],
    [OZON_TITLE, ozonProbes],
    [YM_TITLE, ymProbes],
  ] as const) {
    try {
      all.push(...(await runSuite(title, build(), flags)));
    } catch (e: any) {
      console.log('');
      console.log(c.bold(`━━━ ${title} ━━━`));
      console.log(c.red(`пропущено: ${e?.message || String(e)}`));
    }
  }

  // Сводка
  const ok = all.filter((r) => r.ok).length;
  const fail = all.length - ok;
  console.log('');
  console.log(c.bold('═══ ИТОГ ═══'));
  if (fail === 0) {
    console.log(c.green(`✅ Все пробы прошли: ${ok}/${all.length}`));
  } else {
    console.log(c.yellow(`⚠️  Прошло ${ok}/${all.length}, ошибок: ${fail}`));
    for (const r of all.filter((x) => !x.ok)) {
      const reason = r.http.error || `HTTP ${r.http.status}`;
      console.log(c.red(`   ↳ [${r.category}] ${r.name}: ${reason}`));
    }
  }

  applyExitCode(all);
}

await main();
