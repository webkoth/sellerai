/**
 * /sync CARDS layer — Яндекс.Маркет (offer-mappings).
 * Проще Ozon: offer без словарных характеристик. Габариты WB (см+кг) идут напрямую.
 * marketCategoryId из category-map.json (бижутерийная/сувенирная ветка, ювелирка исключена).
 * Контент через тот же санитайзер (оригинальность/качество). Цена — k_ym (режим A) ставится отдельно (offer-prices).
 *
 * Экспорт: buildYmCards(opts) -> { offers, businessId }
 */
import { readFileSync } from 'node:fs';
const ROOT = '/Users/minas/projects/sai_kotelnikovartifact';
const M = `${ROOT}/mcp`;
const load = f => JSON.parse(readFileSync(`${ROOT}/data/mappings/${f}`, 'utf8'));

function sanitize(s) {
  return (s || '')
    .replace(/сертификат[а-яё]*\s+подлинност[а-яё]*/gi, 'сертификат')
    .replace(/подлинн[а-яё]*/gi, '')
    .replace(/оригинальн[а-яё]*/gi, '')
    .replace(/оригинал[а-яё]*/gi, '')
    .replace(/original[a-z]*/gi, '')
    .replace(/высок[а-яё]*\s+качеств[а-яё]*/gi, '')
    // Оставляем только кириллицу/латиницу/цифры/пунктуацию; вырезаем CJK/фарси/пиньинь-диакритику/эмодзи/спецсимволы.
    .replace(/[^Ѐ-ӿA-Za-z0-9\s.,!?;:()«»"'’\-–—+\/№%°×]/g, ' ')
    .replace(/[ \t]{2,}/g, ' ').replace(/ +([.,])/g, '$1').trim();
}
const charVal = (p, re) => { const c = (p.characteristics || []).find(c => re.test(c.name)); return c && c.value && c.value[0]; };

export async function buildYmCards(opts = {}) {
  const { getProductsInStock } = await import(`${M}/wb-mcp/dist/tools/products-in-stock.js`);
  const { getProducts: ymGetProducts } = await import(`${M}/ym-mcp/dist/tools/products.js`);
  const { getBusinessId } = await import(`${M}/ym-mcp/dist/api/client.js`);
  const catMap = load('category-map.json').map;
  const pricing = load('pricing.json').by_subject;

  const wb = await getProductsInStock({ minQuantity: 1 });
  let ym = [], t, g = 0; do { const r = await ymGetProducts({ limit: 200, pageToken: t }); ym.push(...r.products); t = r.nextPageToken; } while (t && ++g < 10);
  const ymIds = new Set(ym.map(p => String(p.offerId)));

  const want = opts.offerIds && opts.offerIds.length ? new Set(opts.offerIds.map(String)) : null;
  const targets = want ? wb.products.filter(p => want.has(String(p.barcode))) : wb.products.filter(p => !ymIds.has(String(p.barcode)));

  const offers = [];
  for (const it of targets) {
    const cm = catMap[it.category];
    if (!cm || cm.excluded || !cm.ym || !cm.ym.marketCategoryId) continue;
    const d = it.dimensions || {};
    const country = charVal(it, /страна/i) || 'Россия';
    const pr = pricing[it.category] || pricing['Подвески бижутерные'];
    offers.push({
      offer: {
        offerId: String(it.barcode),
        name: sanitize((it.title || '').slice(0, 250)),
        vendor: it.brand || 'KOTELNIKOVARTIFACT',
        vendorCode: String(it.vendorCode),
        barcodes: [String(it.barcode)],
        pictures: (it.photos || []).slice(0, 10),
        description: it.description ? sanitize(it.description).slice(0, 5000) : undefined,
        manufacturerCountries: [country],
        weightDimensions: { length: d.length || 10, width: d.width || 10, height: d.height || 5, weight: d.weight || 0.05 },
        marketCategoryId: cm.ym.marketCategoryId,
      },
      _price: { finalP: it.finalPrice || it.price, baseP: it.price, k: pr.k_ym, subject: it.category },
    });
  }
  return { offers, businessId: getBusinessId() };
}
