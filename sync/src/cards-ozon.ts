/**
 * Сборка Ozon-payload для авто-создания недостающих карточек (порт cards.mjs в TS).
 * Клон проверенного шаблона того же type_id + override специфики + доводка Цвет(10096)/
 * Материал(5309)/ТН ВЭД(22232). Санитайзер режет оригинальность/качество + CJK/спецсимволы.
 * Габариты клампятся в диапазон Ozon. Цена — k_ozon (режим A). offer_id = barcode WB.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createOzonHeaders, OZON_API_URL } from '../../mcp/ozon-mcp/dist/utils/auth.js';
import { getProductsInStock } from '../../mcp/wb-mcp/dist/tools/products-in-stock.js';
import { getProducts as ozGetProducts } from '../../mcp/ozon-mcp/dist/tools/products.js';
import { ROOT, categoryMap, pricing } from './config.js';

const OZON_BIJOUTERIE_CAT = 17027899;
const round10 = (n: number): number => Math.ceil(n / 10) * 10;
const clampDim = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, Math.round(v)));

export interface OzonPayload {
  offer_id: string;
  description_category_id: number;
  type_id: number;
  name: string;
  price: string;
  old_price: string;
  currency_code: string;
  vat: string;
  barcode: string;
  images: string[];
  depth: number;
  width: number;
  height: number;
  dimension_unit: string;
  weight: number;
  weight_unit: string;
  attributes: Array<{ id: number; complex_id?: number; values: Array<{ dictionary_value_id?: number; value: string }> }>;
  _wb?: Record<string, unknown>;
}

function classifyMaterial(s: string | undefined): string | null {
  s = (s || '').toLowerCase();
  if (/железн|металл/.test(s)) return 'Металл';
  if (/стекл|ливийск/.test(s)) return 'Стекло';
  if (/силикон/.test(s)) return 'Силикон';
  if (/камен|хондрит|метеорит|индошинит|тектит|агат|гематит|лава|бронзит|лаврикит|минерал/.test(s)) return 'Натуральный камень';
  return null;
}
const charVal = (p: any, re: RegExp): string | undefined => {
  const c = (p.characteristics || []).find((c: any) => re.test(c.name));
  return c && c.value && c.value[0];
};

function sanitize(s: string | undefined): string {
  return (s || '')
    .replace(/сертификат[а-яё]*\s+подлинност[а-яё]*/gi, 'сертификат')
    .replace(/подлинн[а-яё]*/gi, '')
    .replace(/оригинальн[а-яё]*/gi, '')
    .replace(/оригинал[а-яё]*/gi, '')
    .replace(/original[a-z]*/gi, '')
    .replace(/высок[а-яё]*\s+качеств[а-яё]*/gi, '')
    .replace(/премиальн[а-яё]*/gi, '')
    .replace(/[^Ѐ-ӿA-Za-z0-9\s.,!?;:()«»"'’\-–—+\/№%°×]/g, ' ')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/ +([.,])/g, '$1')
    .trim();
}

export async function buildOzonCards(opts: { offerIds?: string[] } = {}): Promise<{ payloads: OzonPayload[] }> {
  const templates: any = JSON.parse(readFileSync(resolve(ROOT, 'data/mappings/ozon-card-templates.json'), 'utf8'));
  const catMap = (categoryMap as any).map;
  const priceBy = (pricing as any).by_subject;

  const ozPost = async (ep: string, b: any): Promise<any> => {
    const r = await fetch(OZON_API_URL + ep, { method: 'POST', headers: createOzonHeaders(), body: JSON.stringify(b) });
    if (!r.ok) throw new Error(String(r.status));
    return r.json();
  };
  const cache = new Map<string, number | null>();
  const dictSearch = async (attrId: number, type: number, val: string): Promise<number | null> => {
    const k = attrId + ':' + val;
    if (cache.has(k)) return cache.get(k)!;
    let id: number | null = null;
    try {
      const r: any = await ozPost('/v1/description-category/attribute/values/search', {
        description_category_id: OZON_BIJOUTERIE_CAT, type_id: type, attribute_id: attrId, value: val, limit: 3,
      });
      const hit = (r.result || []).find((v: any) => v.value.toLowerCase() === val.toLowerCase()) || (r.result || [])[0];
      if (hit) id = hit.dictionary_value_id || hit.id;
    } catch {
      /* словарь не нашёлся — упадём на дефолт шаблона */
    }
    cache.set(k, id);
    return id;
  };

  const wb: any = await getProductsInStock({ minQuantity: 1 });
  const oz: any = await ozGetProducts({ limit: 1000, visibility: 'ALL' });
  const ozIds = new Set(oz.products.map((p: any) => String(p.offerId)));
  const want = opts.offerIds && opts.offerIds.length ? new Set(opts.offerIds.map(String)) : null;
  const missing = want
    ? wb.products.filter((p: any) => want.has(String(p.barcode)) || want.has(String(p.vendorCode)))
    : wb.products.filter((p: any) => !ozIds.has(String(p.vendorCode)) && !ozIds.has(String(p.barcode)));

  const OVERRIDE = new Set([4180, 4191, 9048, 9024, 10096, 5309, 22232]);
  const payloads: OzonPayload[] = [];
  for (const it of missing) {
    const cm = catMap[it.category];
    if (!cm || cm.excluded) continue;
    const tid = cm.ozon.type_id;
    const tmpl = templates[tid];
    if (!tmpl) continue;
    const pr = priceBy[it.category] || priceBy['Подвески бижутерные'];
    const finalP = it.finalPrice || it.price;
    const baseP = it.price || finalP;
    const price = round10(finalP * pr.k_ozon);
    const oldPrice = baseP > finalP ? round10(baseP * pr.k_ozon) : 0;

    const attrs = tmpl.attributes
      .filter((a: any) => !OVERRIDE.has(a.id))
      .map((a: any) => ({ id: a.id, complex_id: a.complex_id || 0, values: a.values }));
    const wbColor = charVal(it, /цвет/i);
    const colorId = wbColor ? await dictSearch(10096, tid, wbColor) : null;
    const tC = tmpl.attributes.find((a: any) => a.id === 10096);
    attrs.push({ id: 10096, values: [colorId ? { dictionary_value_id: colorId, value: wbColor } : (tC ? tC.values[0] : { dictionary_value_id: 61576, value: 'серый' })] });
    const wbMat = charVal(it, /материал/i);
    const cls = classifyMaterial(wbMat);
    const matId = cls ? await dictSearch(5309, tid, cls) : null;
    const tM = tmpl.attributes.find((a: any) => a.id === 5309);
    attrs.push({ id: 5309, values: [matId ? { dictionary_value_id: matId, value: cls } : (tM ? tM.values[0] : { dictionary_value_id: 62099, value: 'Сталь' })] });
    const tnvedMetal = cls === 'Металл';
    attrs.push({ id: 22232, values: [{ dictionary_value_id: tnvedMetal ? 971399026 : 971399027, value: tnvedMetal ? '7117190000' : '7117900000' }] });
    attrs.push({ id: 9048, values: [{ dictionary_value_id: 0, value: String(it.vendorCode) }] });
    const cleanName = sanitize((it.title || '').slice(0, 200));
    const cleanDesc = it.description ? sanitize(it.description).slice(0, 6000) : null;
    attrs.push({ id: 4180, values: [{ dictionary_value_id: 0, value: cleanName }] });
    if (cleanDesc) attrs.push({ id: 4191, values: [{ dictionary_value_id: 0, value: cleanDesc }] });

    const d = it.dimensions || {};
    payloads.push({
      offer_id: String(it.barcode),
      description_category_id: cm.ozon.category_id,
      type_id: tid,
      name: cleanName,
      price: String(price),
      old_price: oldPrice ? String(oldPrice) : '0',
      currency_code: 'RUB',
      vat: '0',
      barcode: String(it.barcode),
      images: (it.photos || []).slice(0, 15),
      depth: clampDim((d.length || 10) * 10, 5, 250),
      width: clampDim((d.width || 10) * 10, 5, 170),
      height: clampDim((d.height || 5) * 10, 5, 100),
      dimension_unit: 'mm',
      weight: Math.round((d.weight || 0.05) * 1000),
      weight_unit: 'g',
      attributes: attrs,
      _wb: { subject: it.category, finalP, baseP, k: pr.k_ozon, color: wbColor, material: wbMat },
    });
  }
  return { payloads };
}
