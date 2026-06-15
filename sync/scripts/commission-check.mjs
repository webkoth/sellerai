/**
 * Сверка комиссий ПО ФАКТУ vs заложенные ставки модели (pricing.json).
 * WB  — отчёт реализации (reportDetailByPeriod): комиссия + логистика по продажам.
 * Ozon — транзакции (/v3/finance/transaction/list): sale_commission + услуги (логистика).
 * ЯМ  — в MCP только выплаты без разбивки комиссии → сверка недоступна (показываем gap).
 * Read-only, ничего не пишет.
 *
 *   node sync/scripts/commission-check.mjs [дней]   # по умолчанию 60
 */
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { config as dotenvConfig } from 'dotenv';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '../..');
dotenvConfig({ path: resolve(ROOT, '.env') });
const { getRealizationReport } = await import(pathToFileURL(resolve(ROOT, 'mcp/wb-mcp/dist/tools/realization.js')).href);
const { getTransactions } = await import(pathToFileURL(resolve(ROOT, 'mcp/ozon-mcp/dist/tools/finance.js')).href);

const DAYS = Number(process.argv.find((a) => /^\d+$/.test(a))) || 60;
const to = new Date();
const from = new Date(to.getTime() - DAYS * 86400000);
const d10 = (d) => d.toISOString().slice(0, 10);

// заложенные ставки (бижутерия) — pricing.json by_subject + finance DEFAULT_TAKE
const ASSUMED = { wb: 0.32, ozon: 0.53, ym: 0.52 };
const rub = (n) => Math.round(n).toLocaleString('ru-RU') + '₽';
const pc = (n) => (n * 100).toFixed(1) + '%';

console.log(`=== Сверка комиссий по факту · период ${d10(from)} … ${d10(to)} (${DAYS} дн) ===\n`);

// ---------- WB ----------
try {
  const wb = await getRealizationReport({ dateFrom: d10(from), dateTo: d10(to), limit: 100000 });
  let retailAmt = 0, discRev = 0, comm = 0, deliv = 0, forPay = 0, vw = 0, retRev = 0, units = 0, commPctW = 0;
  for (const r of wb.records) {
    const isRet = r.doc_type_name === 'Возврат' || (r.quantity || 0) < 0 || (r.return_amount || 0) > 0;
    const q = r.quantity || 0;
    if (isRet) {
      retRev += r.return_amount || r.retail_amount || 0;
      forPay += r.ppvz_for_pay || 0;  // возврат уменьшает к перечислению
      deliv += r.delivery_rub || 0;
    } else {
      retailAmt += r.retail_amount || 0;
      discRev += (r.retail_price_withdisc_rub || 0) * (q || 1);
      comm += r.ppvz_sales_commission || 0;
      deliv += r.delivery_rub || 0;
      forPay += r.ppvz_for_pay || 0;
      vw += r.ppvz_vw || 0;
      units += q;
      commPctW += (r.commission_percent || 0) * (r.retail_amount || 0);
    }
  }
  // база выручки = фактическая цена продажи (со скидкой). retail_amount часто = до СПП.
  const base = discRev > 0 ? discRev : retailAmt;
  const baseLabel = discRev > 0 ? 'цена со скидкой (retail_price_withdisc)' : 'retail_amount';
  const net = forPay - deliv;             // к перечислению за товар − логистика
  const effTake = base ? 1 - net / base : 0;
  console.log('WB (отчёт реализации):');
  if (!base) {
    console.log('  нет данных о продажах за период (отчёт понедельный — свежие дни могут отсутствовать)');
  } else {
    const retained = base - forPay; // всё, что удержал WB до логистики (комиссия+КВВ+эквайринг)
    console.log(`  продаж: ${units} ед. | база выплаты (${baseLabel}): ${rub(base)} | к перечислению (forPay): ${rub(forPay)}` + (retRev ? ` | возвраты ${rub(retRev)}` : ''));
    console.log(`  ср. номин. ставка комиссии (commission_percent): ${(commPctW / retailAmt).toFixed(1)}%  (≈ заложенные ${pc(ASSUMED.wb)})`);
    console.log('  ФАКТ:');
    console.log(`    удержано WB всего (комиссия + КВВ + эквайринг): ${rub(retained)} = ${pc(retained / base)}`);
    console.log(`      в т.ч. видимые строки: ppvz_sales_commission ${rub(comm)}, ppvz_vw ${rub(vw)}; остальное — КВВ/СПП-механика`);
    console.log(`    логистика (delivery_rub): ${rub(deliv)} = ${pc(deliv / base)}`);
    console.log(`  → эффективная нагрузка WB ВСЕГО: ${pc(effTake)} (заложено ${pc(ASSUMED.wb)} — ${effTake < ASSUMED.wb ? 'модель ЗАВЫШАЕТ' : 'модель ЗАНИЖАЕТ'} на ${pc(Math.abs(effTake - ASSUMED.wb))}, в осн. логистика)`);
  }
} catch (e) {
  console.log('WB: ошибка —', e.message);
}

// ---------- Ozon (помесячные окна — API лимит 1 мес) ----------
try {
  const all = [];
  let wStart = new Date(from);
  while (wStart < to) {
    const wEnd = new Date(Math.min(wStart.getTime() + 29 * 86400000, to.getTime()));
    for (let page = 1; page <= 50; page++) {
      const oz = await getTransactions({ dateFrom: d10(wStart), dateTo: d10(wEnd), transactionType: 'all', page, pageSize: 1000 });
      all.push(...oz.transactions);
      if (oz.transactions.length < 1000) break; // последняя страница окна
    }
    wStart = new Date(wEnd.getTime() + 86400000);
  }
  let rev = 0, comm = 0, serv = 0;
  const byType = {};
  for (const t of all) {
    const orderRel = (t.items && t.items.length) || t.saleAmount !== 0 || (t.services && t.services.length);
    const k = t.operationTypeName || t.operationType || 'Другое';
    byType[k] = byType[k] || { n: 0, accr: 0 };
    byType[k].n++; byType[k].accr += t.accrualAmount || 0;
    if (!orderRel) continue; // отсечь пополнения/выводы
    rev += t.accrualAmount || 0;
    comm += t.saleAmount || 0;
    serv += (t.services || []).reduce((s, x) => s + (x.price || 0), 0);
  }
  const commA = -comm, servA = -serv;
  console.log('\nOzon (транзакции):');
  if (!rev) {
    console.log('  нет продаж за период');
  } else {
    console.log(`  выручка (accruals_for_sale): ${rub(rev)} | операций: ${all.length}`);
    console.log(`  комиссия:  ${rub(commA)}  = ${pc(commA / rev)}   (заложено ${pc(ASSUMED.ozon)})  ${commA / rev > ASSUMED.ozon ? '▲ выше' : '▼ ниже'} на ${pc(Math.abs(commA / rev - ASSUMED.ozon))}`);
    console.log(`  услуги/логистика:  ${rub(servA)}  = ${pc(servA / rev)}   (в модель НЕ заложена)`);
    console.log(`  → эффективная нагрузка Ozon (комиссия+услуги): ${pc((commA + servA) / rev)}`);
    console.log('  по типам операций:');
    for (const [k, v] of Object.entries(byType).sort((a, b) => Math.abs(b[1].accr) - Math.abs(a[1].accr)).slice(0, 8)) console.log(`    ${k}: ${v.n} оп., Σ ${rub(v.accr)}`);
  }
} catch (e) {
  console.log('\nOzon: ошибка —', e.message);
}

// ---------- ЯМ ----------
console.log('\nЯМ: сверка по факту недоступна — в MCP только выплаты (ym_get_payments) без построчной комиссии.');
console.log(`     модель использует ${pc(ASSUMED.ym)} (FEE + ~7% эквайринг/логистика, оценочно). Нужен отчёт ЯМ по заказам.`);

console.log('\nЗаложено в pricing.json/finance.ts: WB 32% (только комиссия), Ozon 53% (только комиссия), ЯМ 52% (FEE+~7%).');
console.log('Логистика/услуги в модели НЕ учитываются — отсюда занижение реальной нагрузки. Цифры выше = фактическая картина.');
