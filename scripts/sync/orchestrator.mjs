/**
 * /sync — оркестратор зеркалирования WB (мастер) -> Ozon / Яндекс.Маркет.
 *
 * SCOPE: только товары WB в наличии (>0). Остальное на площадках -> остаток 0 (каша).
 * Слои: cards -> prices -> stocks. По умолчанию DRY-RUN (preview БЫЛО->СТАЛО, без мутаций).
 *
 * Запуск (dev, через relay): node /tmp/relay/run-sync.mjs --only stocks --mp all
 * Флаги: --mp ozon|ym|all  --only cards|prices|stocks|all  --apply (применить; иначе dry-run)
 *
 * ВНИМАНИЕ: фактическое применение (--apply) изменяет остатки/цены/карточки на площадках.
 * В этой версии реализован безопасный слой STOCKS в режиме preview.
 */
import { readFileSync } from 'node:fs';

const ROOT = '/Users/minas/projects/sai_kotelnikovartifact';
const M = `${ROOT}/mcp`;

// ---------- args ----------
const argv = process.argv.slice(2);
const has = (n) => argv.includes(n);
const val = (n, d) => { const i = argv.indexOf(n); return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : d; };
const MP = val('--mp', 'all');
const ONLY = val('--only', 'stocks');
const APPLY = has('--apply');

const log = (...a) => console.log(...a);
const retry = async (fn, n = 3) => { for (let i = 0; i < n; i++) { try { return await fn(); } catch (e) { if (i === n - 1) throw e; await new Promise(r => setTimeout(r, 1500)); } } };

// ---------- dist functions (починенные в Части 2) ----------
const { getProductsInStock } = await import(`${M}/wb-mcp/dist/tools/products-in-stock.js`);
const ozProd = await import(`${M}/ozon-mcp/dist/tools/products.js`);
const ozStk = await import(`${M}/ozon-mcp/dist/tools/stocks.js`);
const ymProd = await import(`${M}/ym-mcp/dist/tools/products.js`);
const ymStk = await import(`${M}/ym-mcp/dist/tools/stocks.js`);

// ---------- 1. WB master (in-stock) ----------
log(`\n=== /sync  scope=in-stock  mp=${MP}  only=${ONLY}  mode=${APPLY ? 'APPLY' : 'DRY-RUN'} ===\n`);
log('WB: тяну товары в наличии...');
const wb = await retry(() => getProductsInStock({ minQuantity: 1 }));
const wbByBarcode = new Map();
const wbByVendor = new Map();
for (const p of wb.products) {
  wbByBarcode.set(String(p.barcode), p.stock);
  wbByVendor.set(String(p.vendorCode), (wbByVendor.get(String(p.vendorCode)) || 0) + p.stock);
}
log(`WB в наличии: ${wb.products.length} баркодов\n`);

// целевой остаток оффера площадки: WB-остаток если оффер сматчился, иначе 0 (каша)
const targetFor = (offerId) => wbByVendor.get(String(offerId)) ?? wbByBarcode.get(String(offerId)) ?? 0;

// ---------- STOCKS layer ----------
async function planStocks(mp) {
  let products, curStock;
  if (mp === 'ozon') {
    products = (await retry(() => ozProd.getProducts({ limit: 1000, visibility: 'ALL' }))).products.map(p => ({ offerId: String(p.offerId) }));
    const st = (await retry(() => ozStk.getStocks({ limit: 1000, visibility: 'ALL' }))).products;
    curStock = new Map(st.map(s => [String(s.offerId), (s.totalFbo || 0) + (s.totalFbs || 0)]));
  } else {
    let all = [], t, g = 0;
    do { const r = await retry(() => ymProd.getProducts({ limit: 200, pageToken: t })); all.push(...r.products); t = r.nextPageToken; } while (t && ++g < 20);
    products = all.map(p => ({ offerId: String(p.offerId) }));
    const st = (await retry(() => ymStk.getStocks({ limit: 1000 }))).stocks || [];
    curStock = new Map(st.map(s => [String(s.offerId), s.available || 0]));
  }
  const plan = [];
  for (const p of products) {
    const cur = curStock.get(p.offerId) || 0;
    const target = targetFor(p.offerId);
    if (cur !== target) plan.push({ offerId: p.offerId, was: cur, becomes: target, kind: target === 0 ? 'обнулить' : 'выровнять' });
  }
  return { plan, total: products.length };
}

function printStockPlan(mp, res) {
  const zero = res.plan.filter(x => x.kind === 'обнулить');
  const align = res.plan.filter(x => x.kind === 'выровнять');
  log(`--- STOCKS · ${mp.toUpperCase()} (офферов всего: ${res.total}) ---`);
  log(`  к изменению: ${res.plan.length}  (выровнять: ${align.length}, обнулить кашу: ${zero.length})`);
  for (const x of res.plan.slice(0, 12)) log(`   ${x.offerId.padEnd(16)} ${String(x.was).padStart(4)} → ${String(x.becomes).padStart(4)}   [${x.kind}]`);
  if (res.plan.length > 12) log(`   … и ещё ${res.plan.length - 12}`);
  log('');
}

if (ONLY === 'stocks' || ONLY === 'all') {
  for (const mp of (MP === 'all' ? ['ozon', 'ym'] : [MP])) {
    const res = await planStocks(mp);
    printStockPlan(mp, res);
    if (APPLY) log(`  ⚠ APPLY для ${mp}: не реализовано в этой версии (нужен warehouse_id + confirm). Пока только preview.\n`);
  }
}

if (ONLY === 'prices' || ONLY === 'cards' || ONLY === 'all') {
  log('--- PRICES / CARDS: слои в разработке (следующий шаг) ---');
}

log('✓ dry-run завершён. Ничего не изменено.');
