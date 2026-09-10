/**
 * Ассерты на чистый калькулятор pricing.ts (модель v2 «единая база + скидки по комиссиям»).
 * Инварианты: витринная WB неизменна при целой скидке; выплаты площадок ≥ целевой (нетто WB)
 * и близки к ней; единая база; Ozon-скидка ≥5% и ≥500₽; идемпотентность.
 *
 *   node sync/scripts/test-pricing.mjs
 */
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '../..');
const { computeTarget, fitBase } = await import(pathToFileURL(resolve(ROOT, 'sync/dist/pricing.js')).href);

const POLICY = {
  d_headroom: 0.15, round_base_to: 100, min_discount_pct: 5,
  wb_min_discount_pct: 3, wb_max_discount_pct: 95,
  ozon_min_discount_rub: 500, ozon_min_price_factor: 0.95,
  final_price_ending: 90,
};
const RATES = { take_wb: 0.44, take_ozon: 0.55, take_ym: 0.551 }; // бижутерия, свежие ставки

let failed = 0;
const check = (name, cond, detail = '') => {
  console.log(`${cond ? '✅' : '❌'} ${name}${detail ? ' — ' + detail : ''}`);
  if (!cond) failed++;
};
const mk = (over = {}) => computeTarget({
  barcode: 'bc1', nmId: 111, vendorCode: 'VC1', category: 'Подвески бижутерные', title: 'Тест',
  wbFinal: 1800, ozonOfferId: 'bc1', ymOfferId: 'bc1', ...over,
}, RATES, POLICY);

// --- 1. базовый кейс: витринная WB неизменна, единая база, скидки в норме
{
  const t = mk();
  check('WB-финалка неизменна (целая скидка, точное деление)',
    t.wb && t.wb.exact && Math.abs(t.wb.price * (100 - t.wb.discount) / 100 - 1800) < 0.005,
    `база ${t.base}, скидка ${t.wb?.discount}%`);
  check('единая база на всех площадках',
    t.wb?.price === t.base && t.ozon?.oldPrice === t.base && t.ym?.discountBase === t.base);
  check('выплаты ≥ нетто WB и в пределах округления (психологическое ...90 добавляет ≤100₽ к финалке)',
    [t.payouts.ozon, t.payouts.ym].every((v) => v >= t.payouts.net - 1 && v <= t.payouts.net * 1.02 + 60),
    `net=${t.payouts.net} oz=${t.payouts.ozon} ym=${t.payouts.ym}`);
  check('финалки зеркал оканчиваются на 90', t.ozon.price % 100 === 90 && t.ym.value % 100 === 90,
    `oz=${t.ozon.price} ym=${t.ym.value}`);
  check('Ozon: финалка выше WB (компенсация комиссии)', t.ozon.price > 1800, `oz=${t.ozon.price}`);
  check('Ozon: скидка ≥5% и ≥500₽',
    t.base - t.ozon.price >= Math.max(0.05 * t.base, 500) - 0.005,
    `база−цена=${t.base - t.ozon.price}`);
  check('Ozon: min_price = 95% финалки', t.ozon.minPrice === Math.round(t.ozon.price * 0.95));
  check('ЯМ: скидка 1..99', t.ym.discountPct >= 1 && t.ym.discountPct <= 99, `${t.ym.discountPct}%`);
  check('без пропусков', t.skips.length === 0, t.skips.join(','));
}

// --- 2. дешёвый товар: рублёвый минимум скидки Ozon двигает базу
{
  const t = mk({ wbFinal: 490 });
  check('дёшево: Ozon-скидка ≥500₽', t.base - t.ozon.price >= 500 - 0.005, `база=${t.base} oz=${t.ozon.price}`);
  check('дёшево: WB-финалка неизменна', Math.abs(t.wb.price * (100 - t.wb.discount) / 100 - 490) <= 0.5,
    `база ${t.base} скидка ${t.wb.discount}% exact=${t.wb.exact}`);
}

// --- 3. предмет без ставок → skip, без тихого фолбэка
{
  const t = computeTarget({
    barcode: 'bc2', nmId: 222, vendorCode: 'VC2', category: 'Часы наручные', title: 'Часы',
    wbFinal: 5000, ozonOfferId: 'bc2', ymOfferId: 'bc2',
  }, null, POLICY);
  check('нет ставок → skip no-rates, ничего не считаем', !t.wb && !t.ozon && !t.ym && t.skips.some((s) => s.startsWith('no-rates')));
}

// --- 4. нет линков → skip площадки, WB считается
{
  const t = mk({ ozonOfferId: undefined, ymOfferId: undefined });
  check('нет линков → skips + WB-план есть',
    !t.ozon && !t.ym && !!t.wb && t.skips.includes('no-ozon-link') && t.skips.includes('no-ym-link'));
}

// --- 5. live-ставка Ozon per-SKU приоритетнее by_subject
{
  const a = mk();                              // by_subject 0.55
  const b = mk({ liveOzonTakeFbs: 0.60 });     // live выше
  check('live take_ozon применяется', b.ozon.price > a.ozon.price, `${a.ozon.price} → ${b.ozon.price}`);
}

// --- 6. идемпотентность: повторный расчёт от той же WB-финалки даёт тот же target
{
  const t1 = mk();
  const t2 = mk();
  check('идемпотентность target(x)==target(x)', JSON.stringify(t1) === JSON.stringify(t2));
}

// --- 7. fitBase: разумный диапазон и точность на сетке цен
{
  let bad = 0, inexact = 0;
  for (let f = 100; f <= 30000; f += 37) {
    const r = fitBase(f, f * 1.6, 3, 95);
    if (r.base < f * 1.6 - 0.5) bad++;
    if (!r.exact) inexact++;
    else if ((r.base * (100 - r.discount)) % 100 !== 0 || r.base * (100 - r.discount) / 100 !== f) bad++;
  }
  check('fitBase: база ≥ требуемой и точная финалка на сетке 100..30000', bad === 0, `нарушений: ${bad}`);
  console.log(`   (неточных подгонок на сетке: ${inexact} — допустимо, ловится верификацией)`);
}

console.log(failed ? `\n❌ ПРОВАЛОВ: ${failed}` : '\n✅ Все инварианты выполнены');
process.exit(failed ? 1 : 0);
