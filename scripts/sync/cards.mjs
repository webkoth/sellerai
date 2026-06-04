/**
 * /sync CARDS layer — сборка Ozon-payload для заливки отсутствующих in-stock товаров.
 *
 * Подход: клон проверенного шаблона (карточка того же type_id, прошедшая модерацию) +
 *  override специфики товара (название/описание/артикул/фото/габариты/цена) +
 *  доводка Цвет(10096) и Материал(5309) из WB-характеристик в словари Ozon.
 *
 * Цена: pricing.json режим A (k под комиссии площадки). offer_id = баркод WB.
 * Требует доступ к Ozon API (резолв словарей) — запуск через relay-обёртку.
 *
 * Экспорт: buildOzonCards() -> { payloads, preview }
 */
import { readFileSync } from 'node:fs';

const ROOT = '/Users/minas/projects/sai_kotelnikovartifact';
const M = `${ROOT}/mcp`;
const OZON_BIJOUTERIE_CAT = 17027899;
const round10 = n => Math.ceil(n / 10) * 10;

const load = f => JSON.parse(readFileSync(`${ROOT}/data/mappings/${f}`, 'utf8'));

function classifyMaterial(s) {
  s = (s || '').toLowerCase();
  if (/железн|металл/.test(s)) return 'Металл';
  if (/стекл|ливийск/.test(s)) return 'Стекло';
  if (/силикон/.test(s)) return 'Силикон';
  if (/камен|хондрит|метеорит|индошинит|тектит|агат|гематит|лава|бронзит|лаврикит|минерал/.test(s)) return 'Натуральный камень';
  return null;
}
const charVal = (p, re) => { const c = (p.characteristics || []).find(c => re.test(c.name)); return c && c.value && c.value[0]; };

// Ozon запрещает указание на оригинальность/подлинность в названии и описании (антиконтрафакт).
function sanitize(s) {
  // ВАЖНО: \w в JS не матчит кириллицу — используем явные диапазоны [а-яё].
  return (s || '')
    .replace(/сертификат[а-яё]*\s+подлинност[а-яё]*/gi, 'сертификат')
    .replace(/подлинн[а-яё]*/gi, '')
    .replace(/оригинальн[а-яё]*/gi, '')
    .replace(/оригинал[а-яё]*/gi, '')
    .replace(/original[a-z]*/gi, '')
    .replace(/высок[а-яё]*\s+качеств[а-яё]*/gi, '')
    .replace(/премиальн[а-яё]*/gi, '')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/ +([.,])/g, '$1')
    .trim();
}

export async function buildOzonCards(opts = {}) {
  const { createOzonHeaders, OZON_API_URL } = await import(`${M}/ozon-mcp/dist/utils/auth.js`);
  const { getProductsInStock } = await import(`${M}/wb-mcp/dist/tools/products-in-stock.js`);
  const { getProducts: ozGetProducts } = await import(`${M}/ozon-mcp/dist/tools/products.js`);

  const templates = load('ozon-card-templates.json');
  const catMap = load('category-map.json').map;
  const pricing = load('pricing.json').by_subject;

  const ozPost = async (ep, b) => { const r = await fetch(OZON_API_URL + ep, { method: 'POST', headers: createOzonHeaders(), body: JSON.stringify(b) }); if (!r.ok) throw new Error(r.status); return r.json(); };
  const cache = new Map();
  const dictSearch = async (attrId, type, val) => {
    const k = attrId + ':' + val; if (cache.has(k)) return cache.get(k);
    let id = null;
    try { const r = await ozPost('/v1/description-category/attribute/values/search', { description_category_id: OZON_BIJOUTERIE_CAT, type_id: type, attribute_id: attrId, value: val, limit: 3 });
      const hit = (r.result || []).find(v => v.value.toLowerCase() === val.toLowerCase()) || (r.result || [])[0];
      if (hit) id = hit.dictionary_value_id || hit.id; } catch {}
    cache.set(k, id); return id;
  };

  const wb = await getProductsInStock({ minQuantity: 1 });
  const oz = await ozGetProducts({ limit: 1000, visibility: 'ALL' });
  const ozIds = new Set(oz.products.map(p => String(p.offerId)));
  // По умолчанию — отсутствующие на Ozon. opts.offerIds — точечная сборка (вкл. обновления уже залитых).
  const want = opts.offerIds && opts.offerIds.length ? new Set(opts.offerIds.map(String)) : null;
  const missing = want
    ? wb.products.filter(p => want.has(String(p.barcode)) || want.has(String(p.vendorCode)))
    : wb.products.filter(p => !ozIds.has(String(p.vendorCode)) && !ozIds.has(String(p.barcode)));

  const OVERRIDE = new Set([4180, 4191, 9048, 9024, 10096, 5309, 22232]);
  const payloads = [];
  for (const it of missing) {
    const cm = catMap[it.category]; if (!cm || cm.excluded) continue;
    const tid = cm.ozon.type_id, tmpl = templates[tid]; if (!tmpl) continue;
    const pr = pricing[it.category] || pricing['Подвески бижутерные'];
    const finalP = it.finalPrice || it.price, baseP = it.price || finalP;
    const price = round10(finalP * pr.k_ozon), oldPrice = baseP > finalP ? round10(baseP * pr.k_ozon) : 0;

    const attrs = tmpl.attributes.filter(a => !OVERRIDE.has(a.id)).map(a => ({ id: a.id, complex_id: a.complex_id || 0, values: a.values }));
    // Цвет
    const wbColor = charVal(it, /цвет/i);
    const colorId = wbColor ? await dictSearch(10096, tid, wbColor) : null;
    const tC = tmpl.attributes.find(a => a.id === 10096);
    attrs.push({ id: 10096, values: [colorId ? { dictionary_value_id: colorId, value: wbColor } : (tC ? tC.values[0] : { dictionary_value_id: 61576, value: 'серый' })] });
    // Материал
    const wbMat = charVal(it, /материал/i), cls = classifyMaterial(wbMat);
    const matId = cls ? await dictSearch(5309, tid, cls) : null;
    const tM = tmpl.attributes.find(a => a.id === 5309);
    attrs.push({ id: 5309, values: [matId ? { dictionary_value_id: matId, value: cls } : (tM ? tM.values[0] : { dictionary_value_id: 62099, value: 'Сталь' })] });
    // ТН ВЭД коды ЕАЭС (22232) — обязателен для продажи: металл -> 7117190000, иначе -> 7117900000 (прочая бижутерия)
    const tnvedMetal = cls === 'Металл';
    attrs.push({ id: 22232, values: [{ dictionary_value_id: tnvedMetal ? 971399026 : 971399027, value: tnvedMetal ? '7117190000' : '7117900000' }] });
    // override
    attrs.push({ id: 9048, values: [{ dictionary_value_id: 0, value: String(it.vendorCode) }] });
    const cleanName = sanitize((it.title || '').slice(0, 200));
    const cleanDesc = it.description ? sanitize(it.description).slice(0, 6000) : null;
    attrs.push({ id: 4180, values: [{ dictionary_value_id: 0, value: cleanName }] });
    if (cleanDesc) attrs.push({ id: 4191, values: [{ dictionary_value_id: 0, value: cleanDesc }] });

    const d = it.dimensions || {};
    payloads.push({
      offer_id: String(it.barcode), description_category_id: cm.ozon.category_id, type_id: tid,
      name: cleanName, price: String(price), old_price: oldPrice ? String(oldPrice) : '0',
      currency_code: 'RUB', vat: '0', barcode: String(it.barcode),
      images: (it.photos || []).slice(0, 15),
      depth: Math.round((d.length || 10) * 10), width: Math.round((d.width || 10) * 10), height: Math.round((d.height || 5) * 10),
      dimension_unit: 'mm', weight: Math.round((d.weight || 0.05) * 1000), weight_unit: 'g',
      attributes: attrs,
      _wb: { subject: it.category, finalP, baseP, k: pr.k_ozon, color: wbColor, material: wbMat },
    });
  }
  return { payloads };
}
