/**
 * Сборка Ozon-payload для авто-создания недостающих карточек (порт cards.mjs в TS).
 * Клон проверенного шаблона того же type_id + override специфики + доводка Цвет(10096)/
 * Материал(5309)/ТН ВЭД(22232). Санитайзер режет оригинальность/качество + CJK/спецсимволы.
 * Габариты клампятся в диапазон Ozon.
 * 2026-09-04: offer_id = артикул WB (если уникален среди WB-наличия, иначе баркод), цена — модель v2
 * (computeTarget), снимок WB передаётся снаружи (один запрос цен на оба построителя), типы без
 * шаблона в ветке бижутерии заводятся как «Подвеска», пропуски собираются в opts.skipped.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createOzonHeaders, OZON_API_URL } from '../../mcp/ozon-mcp/dist/utils/auth.js';
import { getProducts as ozGetProducts } from '../../mcp/ozon-mcp/dist/tools/products.js';
import { ROOT, categoryMap, pricing } from './config.js';
import { computeTarget, type BasePolicy, type SubjectRates } from './pricing.js';
import { mirrorOfferId, countVendorCodes } from './cards-ym.js';

const OZON_BIJOUTERIE_CAT = 17027899;
// Тип «Подвеска»: шаблон-донор для типов бижутерии без своего шаблона (Шарм 87593414 и т.п.)
const FALLBACK_TYPE_ID = 87458901;
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

export async function buildOzonCards(wbProducts: any[], opts: { offerIds?: string[]; skipped?: string[] } = {}): Promise<{ payloads: OzonPayload[] }> {
  const templates: any = JSON.parse(readFileSync(resolve(ROOT, 'data/mappings/ozon-card-templates.json'), 'utf8'));
  const catMap = (categoryMap as any).map;
  const bySubject: Record<string, SubjectRates> = (pricing as any).by_subject || {};
  const policy: BasePolicy = (pricing as any).base_policy;
  const skipped = opts.skipped ?? [];

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

  const oz: any = await ozGetProducts({ limit: 1000, visibility: 'ALL' });
  const ozIds = new Set(oz.products.map((p: any) => String(p.offerId)));
  const want = opts.offerIds && opts.offerIds.length ? new Set(opts.offerIds.map(String)) : null;
  const missing = want
    ? wbProducts.filter((p: any) => want.has(String(p.barcode)) || want.has(String(p.vendorCode)))
    : wbProducts.filter((p: any) => !ozIds.has(String(p.vendorCode)) && !ozIds.has(String(p.barcode)));
  const vendorCount = countVendorCodes(wbProducts);

  const OVERRIDE = new Set([4180, 4191, 9048, 9024, 10096, 5309, 22232]);
  const payloads: OzonPayload[] = [];
  for (const it of missing) {
    const cm = catMap[it.category];
    const label = `${it.barcode} ${(it.title || '').slice(0, 40)}`;
    if (!cm || cm.excluded) { skipped.push(`Ozon ${label}: категория «${it.category}» не замаплена/исключена`); continue; }
    let tid = cm.ozon.type_id;
    let tmpl = templates[tid];
    if (!tmpl && cm.ozon.category_id === OZON_BIJOUTERIE_CAT && templates[FALLBACK_TYPE_ID]) {
      tid = FALLBACK_TYPE_ID; // шарм и другие типы бижутерии без шаблона — заводим как «Подвеска»
      tmpl = templates[tid];
    }
    if (!tmpl) { skipped.push(`Ozon ${label}: нет шаблона для типа ${cm.ozon.type_name || tid} — завести вручную`); continue; }
    const offerId = mirrorOfferId(it, vendorCount);
    const rates = bySubject[it.category] || bySubject['Подвески бижутерные'];
    const tg = computeTarget(
      { barcode: String(it.barcode), nmId: Number(it.nmId) || 0, vendorCode: String(it.vendorCode), category: it.category, title: it.title || '', wbFinal: Number(it.finalPrice) || 0, ozonOfferId: offerId },
      rates, policy,
    );
    if (!tg.ozon) { skipped.push(`Ozon ${label}: цена не рассчиталась (${tg.skips.join(', ')})`); continue; }
    const finalP = tg.wbFinal;
    const baseP = it.price || finalP;
    const price = tg.ozon.price;
    const oldPrice = tg.ozon.oldPrice;

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
      offer_id: offerId,
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
      _wb: { subject: it.category, typeName: tid === cm.ozon.type_id ? cm.ozon.type_name : `${cm.ozon.type_name}→Подвеска`, finalP, baseP, minPrice: tg.ozon.minPrice, stock: Number(it.stock) || 0, barcode: String(it.barcode), color: wbColor, material: wbMat },
    });
  }
  return { payloads };
}
