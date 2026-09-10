/**
 * Пересборка data/mappings/pricing.json под модель «единая база + скидки по комиссиям» (v2).
 * Источники:
 *   - data/commissions/wb_commissions.json  — kgvpMarketplace (FBS) по WB-предметам (свежий снапшот);
 *   - data/commissions/ozon_commissions.json — sales_percent_fbs + acquiring(₽) per SKU;
 *   - data/commissions/ym_commissions.json  — тарифы калькулятора по фактическим категориям офферов;
 *   - live WB in-stock (barcode→предмет), live ЯМ offer-mappings (offerId→категория),
 *     live /v2/tariffs/calculate для категорий из category-map, которых нет в снапшоте.
 *
 * ЯМ-ставка предмета = МАКСИМУМ (консервативно) по фактическим категориям его офферов:
 * FEE + PAYMENT_TRANSFER (relative). Логистика (DELIVERY_TO_CUSTOMER/MIDDLE_MILE) не входит —
 * модель «комиссия + эквайринг», консистентно с WB (kgvp + 2%) и Ozon (sales_percent_fbs + acquiring%).
 *
 * Пишет data/mappings/pricing.proposed.json + печатает таблицу было→стало. Боевой pricing.json НЕ трогает.
 *
 *   node sync/scripts/rebuild-pricing.mjs
 */
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { readFileSync, writeFileSync } from 'node:fs';
import { config as dotenvConfig } from 'dotenv';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '../..');
dotenvConfig({ path: resolve(ROOT, '.env') });

const { getProductsInStock } = await import(pathToFileURL(resolve(ROOT, 'mcp/wb-mcp/dist/tools/products-in-stock.js')).href);
const { apiRequest: ymApiRequest } = await import(pathToFileURL(resolve(ROOT, 'mcp/ym-mcp/dist/api/client.js')).href);

const J = (rel) => JSON.parse(readFileSync(resolve(ROOT, rel), 'utf8'));
const wbComm = J('data/commissions/wb_commissions.json');
const ozComm = J('data/commissions/ozon_commissions.json');
const ymComm = J('data/commissions/ym_commissions.json');
const catMap = J('data/mappings/category-map.json');
const oldPricing = J('data/mappings/pricing.json');

const WB_ACQUIRING = 0.02; // эквайринг/КВВ WB — в tariffs/commission не отдаётся, константа модели
const median = (a) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : null; };
const pc = (x) => (x == null ? '—' : (x * 100).toFixed(1) + '%');

// ---------- WB: kgvpMarketplace по предметам наших in-stock товаров ----------
const wbRows = wbComm.commissions || wbComm.raw_response?.report || [];
const kgvpBySubject = new Map(wbRows.map((r) => [r.subjectName, r.kgvpMarketplace]));

const inStock = await getProductsInStock({ minQuantity: 1 });
const items = inStock.products || [];
console.log(`WB in-stock: ${items.length} позиций`);
const subjects = [...new Set(items.map((p) => p.category).filter(Boolean))];
console.log(`Предметы: ${subjects.join(', ')}\n`);

// ---------- Ozon: медианы по предметам (линк offer_id = barcode | vendorCode) ----------
const ozByOffer = new Map();
for (const p of ozComm.products_with_commissions || []) {
  const price = Number(p.price?.marketing_seller_price) || Number(p.price?.price) || 0;
  ozByOffer.set(String(p.offer_id), {
    fbs: Number(p.commissions?.sales_percent_fbs) || 0,
    acqPct: price > 0 && Number(p.acquiring) > 0 ? Number(p.acquiring) / price : null,
  });
}
const ozAcqAll = [...ozByOffer.values()].map((x) => x.acqPct).filter((x) => x != null);
const ozAcqMedian = median(ozAcqAll) ?? 0.015;
console.log(`Ozon acquiring медиана: ${pc(ozAcqMedian)} (по ${ozAcqAll.length} SKU)`);

// ---------- ЯМ: offerId → фактическая категория ----------
const ymOfferCat = new Map();
let pageToken = null;
for (;;) {
  // ЯМ: limit и page_token — ТОЛЬКО query-параметры (в теле игнорируются → зацикливание на 1-й странице)
  const q = new URLSearchParams({ limit: '200' });
  if (pageToken) q.set('page_token', pageToken);
  const r = await ymApiRequest(`/v2/businesses/${process.env.YM_BUSINESS_ID}/offer-mappings?${q}`, 'POST', { archived: false });
  const mappings = r?.result?.offerMappings || [];
  for (const m of mappings) {
    const cid = m.mapping?.marketCategoryId;
    if (m.offer?.offerId && cid) ymOfferCat.set(String(m.offer.offerId), { id: cid, name: m.mapping?.marketCategoryName || '' });
  }
  pageToken = r?.result?.paging?.nextPageToken;
  if (!pageToken || !mappings.length) break;
}
console.log(`ЯМ offer-mappings: ${ymOfferCat.size} офферов с категорией`);

// тарифы по категориям: снапшот + live-дозапрос недостающих
const ymTariffByCat = new Map();
const feePlusTransfer = (tariffs) => {
  let take = 0;
  for (const t of tariffs || []) {
    const params = Object.fromEntries((t.parameters || []).map((p) => [p.name, p.value]));
    if ((t.type === 'FEE' || t.type === 'PAYMENT_TRANSFER' || t.type === 'AGENCY_COMMISSION') && params.valueType === 'relative') {
      take += Number(params.value) / 100;
    }
  }
  return take || null;
};
for (const t of ymComm.tariffs_by_category || []) {
  ymTariffByCat.set(t.categoryId, { name: t.categoryName, take: feePlusTransfer(t.tariffs) });
}
async function ymTariffLive(categoryId) {
  if (ymTariffByCat.has(categoryId)) return ymTariffByCat.get(categoryId);
  try {
    const r = await ymApiRequest('/v2/tariffs/calculate', 'POST', {
      parameters: { campaignId: Number(process.env.YM_CAMPAIGN_ID) },
      offers: [{ categoryId, price: 10000, length: 20, width: 15, height: 10, weight: 0.5 }],
    });
    const tariffs = r?.result?.offers?.[0]?.tariffs || [];
    const entry = { name: `live:${categoryId}`, take: feePlusTransfer(tariffs) };
    ymTariffByCat.set(categoryId, entry);
    return entry;
  } catch (e) {
    console.log(`  ⚠️ ЯМ калькулятор не ответил для категории ${categoryId}: ${e.message}`);
    return null;
  }
}

// ---------- Сборка by_subject ----------
const bySubject = {};
const notes = [];
for (const subj of subjects) {
  const kgvp = kgvpBySubject.get(subj);
  const take_wb = kgvp != null ? +(kgvp / 100 + WB_ACQUIRING).toFixed(4) : null;
  if (kgvp == null) notes.push(`⚠️ WB kgvp не найден для предмета «${subj}»`);

  const subjItems = items.filter((p) => p.category === subj);

  // Ozon: медиана live fbs% по SKU предмета (+медианный эквайринг)
  const fbsList = [];
  for (const p of subjItems) {
    const oz = ozByOffer.get(String(p.barcode)) ?? ozByOffer.get(String(p.vendorCode));
    if (oz && oz.fbs > 0) fbsList.push(oz.fbs / 100);
  }
  const fbsMed = median(fbsList);
  const take_ozon = fbsMed != null ? +(fbsMed + ozAcqMedian).toFixed(4) : null;
  if (fbsMed == null) notes.push(`⚠️ Ozon: нет живых SKU с комиссией для предмета «${subj}» (take_ozon=null)`);

  // ЯМ: max по фактическим категориям офферов предмета; фолбэк — категория из category-map
  const cats = new Map();
  for (const p of subjItems) {
    const c = ymOfferCat.get(String(p.barcode));
    if (c) cats.set(c.id, c.name);
  }
  let take_ym = null;
  const catInfo = [];
  for (const [cid, cname] of cats) {
    const t = await ymTariffLive(cid);
    if (t?.take != null) { catInfo.push(`${cname}(${cid})=${pc(t.take)}`); take_ym = Math.max(take_ym ?? 0, t.take); }
  }
  if (take_ym == null) {
    const mapped = catMap.map?.[subj]?.ym?.marketCategoryId;
    if (mapped) {
      const t = await ymTariffLive(mapped);
      if (t?.take != null) { take_ym = t.take; catInfo.push(`map:${mapped}=${pc(t.take)}`); }
    }
  }
  if (take_ym != null) take_ym = +take_ym.toFixed(4);
  else notes.push(`⚠️ ЯМ: нет тарифа для предмета «${subj}» (нет офферов и категории в map)`);
  if (cats.size > 1) notes.push(`⚠️ ЯМ: офферы предмета «${subj}» в ${cats.size} категориях: ${catInfo.join(', ')} — взят max`);

  bySubject[subj] = {
    take_wb, take_ozon, take_ym,
    sources: {
      wb: kgvp != null ? `kgvpMarketplace ${kgvp}% + эквайринг ${WB_ACQUIRING * 100}%` : 'нет в tariffs/commission',
      ozon: fbsMed != null ? `медиана sales_percent_fbs ${pc(fbsMed)} (${fbsList.length} SKU) + acquiring ${pc(ozAcqMedian)}` : 'нет live SKU',
      ym: catInfo.join('; ') || 'нет данных',
    },
  };
}

// ---------- Вывод и proposed-файл ----------
console.log('\n=== Ставки: было (03.06) → стало (сегодня) ===');
const k = (twb, tmp) => (twb != null && tmp != null ? ((1 - twb) / (1 - tmp)).toFixed(3) : '—');
for (const [subj, v] of Object.entries(bySubject)) {
  const o = oldPricing.by_subject?.[subj] || {};
  console.log(`\n${subj}:`);
  console.log(`  WB:   ${pc(o.take_wb)} → ${pc(v.take_wb)}   (${v.sources.wb})`);
  console.log(`  Ozon: ${pc(o.take_ozon)} → ${pc(v.take_ozon)}  k=${k(v.take_wb, v.take_ozon)} (было ${o.k_ozon ?? '—'})`);
  console.log(`  ЯМ:   ${pc(o.take_ym)} → ${pc(v.take_ym)}  k=${k(v.take_wb, v.take_ym)} (было ${o.k_ym ?? '—'}) [${v.sources.ym}]`);
}
if (notes.length) { console.log('\n=== Предупреждения ==='); notes.forEach((n) => console.log('  ' + n)); }

const proposed = {
  _meta: {
    description: 'SSOT: модель ценообразования v2 «единая база + скидки по комиссиям» (WB мастер → Ozon/ЯМ).',
    master: 'wildberries',
    mode: 'unified_base_v2',
    updated: new Date().toISOString().slice(0, 10),
    formula: {
      net: 'wb_final × (1 − take_wb)   // wb_final = discountedPrice, якорь, НЕ меняется',
      final_mp: 'roundUp10( net / (1 − take_mp) )   // полная компенсация комиссий',
      base: 'единая цена до скидки: наименьшая ≥ max(finalMax/(1−d_headroom), final_oz+500, final_mp/0.95) с целой WB-скидкой',
      discount_mp: '1 − final_mp / base',
    },
    rates_model: 'комиссия + эквайринг (без логистики): WB kgvp+2%, Ozon sales_percent_fbs+acquiring, ЯМ FEE+PAYMENT_TRANSFER',
    note_live_ozon: 'В рантайме take_ozon приоритетно берётся live per-SKU (sales_percent_fbs+acquiring из v5 цен); by_subject — фолбэк.',
  },
  acquiring: { wb: WB_ACQUIRING, ozon_median: +ozAcqMedian.toFixed(4) },
  base_policy: {
    d_headroom: 0.15,
    round_base_to: 100,
    min_discount_pct: 5,
    wb_min_discount_pct: 3,
    wb_max_discount_pct: 95,
    ozon_min_discount_rub: 500,
    ozon_min_price_factor: 0.95,
  },
  by_subject: bySubject,
  guardrails: {
    rounding: { rule: 'round_up_to', step: 10 },
    price_min_change_pct: 2,
    price_max_change_pct: 60,
    prices_abort_if_changes_over: 400,
    no_negative_discount: true,
  },
};
const outPath = resolve(ROOT, 'data/mappings/pricing.proposed.json');
writeFileSync(outPath, JSON.stringify(proposed, null, 2) + '\n');
console.log(`\nПредложение записано: ${outPath}\nПосле ревью заменить им data/mappings/pricing.json.`);
