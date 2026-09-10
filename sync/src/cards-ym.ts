/**
 * Сборка ЯМ offer-payload для авто-создания недостающих карточек.
 * Категория из category-map (бижутерия/сувениры, ювелирка исключена). Санитайзер режет
 * оригинальность/качество + CJK/спецсимволы.
 *
 * 2026-09-04: ключ оффера — артикул WB (vendorCode), как у карточек нового магазина ИП; баркод —
 * только если артикул не уникален среди WB-наличия (размерные ряды). Проверка «нет карточки» —
 * по обоим ключам (раньше только по баркоду → пересоздавала дубли). Цена — модель v2
 * (sync/src/pricing.ts: единая база + скидка по комиссии), а не старый k_ym.
 */
import { getProducts as ymGetProducts } from '../../mcp/ym-mcp/dist/tools/products.js';
import { getBusinessId } from '../../mcp/ym-mcp/dist/api/client.js';
import { categoryMap, pricing } from './config.js';
import { computeTarget, type BasePolicy, type SubjectRates } from './pricing.js';

export interface YmOfferBuilt {
  offer: {
    offerId: string;
    name: string;
    vendor: string;
    vendorCode: string;
    barcodes: string[];
    pictures: string[];
    description?: string;
    manufacturerCountries: string[];
    weightDimensions: { length: number; width: number; height: number; weight: number };
    marketCategoryId: number;
  };
  _price: { value: number; discountBase: number; wbFinal: number; subject: string };
  _wb: { barcode: string; stock: number; category: string; categoryName: string };
}

function sanitize(s: string | undefined): string {
  return (s || '')
    .replace(/сертификат[а-яё]*\s+подлинност[а-яё]*/gi, 'сертификат')
    .replace(/подлинн[а-яё]*/gi, '')
    .replace(/оригинальн[а-яё]*/gi, '')
    .replace(/оригинал[а-яё]*/gi, '')
    .replace(/original[a-z]*/gi, '')
    .replace(/высок[а-яё]*\s+качеств[а-яё]*/gi, '')
    .replace(/[^Ѐ-ӿA-Za-z0-9\s.,!?;:()«»"'’\-–—+\/№%°×]/g, ' ')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/ +([.,])/g, '$1')
    .trim();
}

const charVal = (p: any, re: RegExp): string | undefined => {
  const c = (p.characteristics || []).find((c: any) => re.test(c.name));
  return c && c.value && c.value[0];
};

/** Ключ оффера зеркала: артикул WB, если уникален среди WB-наличия, иначе баркод. */
export function mirrorOfferId(it: any, vendorCount: Map<string, number>): string {
  const vc = String(it.vendorCode || '');
  return vc && vendorCount.get(vc) === 1 ? vc : String(it.barcode);
}
export function countVendorCodes(wbProducts: any[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const p of wbProducts) {
    const vc = String(p.vendorCode || '');
    if (vc) m.set(vc, (m.get(vc) || 0) + 1);
  }
  return m;
}

export async function buildYmCards(wbProducts: any[], opts: { offerIds?: string[]; skipped?: string[] } = {}): Promise<{ offers: YmOfferBuilt[]; businessId: number }> {
  const catMap = (categoryMap as any).map;
  const bySubject: Record<string, SubjectRates> = (pricing as any).by_subject || {};
  const policy: BasePolicy = (pricing as any).base_policy;
  const skipped = opts.skipped ?? [];

  const ym: any[] = [];
  let t: string | undefined;
  let g = 0;
  do {
    const r: any = await ymGetProducts({ limit: 200, pageToken: t });
    ym.push(...r.products);
    t = r.nextPageToken;
  } while (t && ++g < 10);
  const ymIds = new Set(ym.map((p: any) => String(p.offerId)));

  const want = opts.offerIds && opts.offerIds.length ? new Set(opts.offerIds.map(String)) : null;
  const targets = want
    ? wbProducts.filter((p: any) => want.has(String(p.barcode)) || want.has(String(p.vendorCode)))
    : wbProducts.filter((p: any) => !ymIds.has(String(p.barcode)) && !ymIds.has(String(p.vendorCode)));
  const vendorCount = countVendorCodes(wbProducts);

  const offers: YmOfferBuilt[] = [];
  for (const it of targets) {
    const cm = catMap[it.category];
    const label = `${it.barcode} ${(it.title || '').slice(0, 40)}`;
    if (!cm || cm.excluded) { skipped.push(`ЯМ ${label}: категория «${it.category}» не замаплена/исключена`); continue; }
    if (!cm.ym || cm.ym.excluded || !cm.ym.marketCategoryId) { skipped.push(`ЯМ ${label}: «${it.category}» на ЯМ не зеркалим (${cm.ym?.reason || 'нет marketCategoryId'})`); continue; }
    const offerId = mirrorOfferId(it, vendorCount);
    const rates = bySubject[it.category] || bySubject['Подвески бижутерные'];
    const tg = computeTarget(
      { barcode: String(it.barcode), nmId: Number(it.nmId) || 0, vendorCode: String(it.vendorCode), category: it.category, title: it.title || '', wbFinal: Number(it.finalPrice) || 0, ymOfferId: offerId },
      rates, policy,
    );
    if (!tg.ym) { skipped.push(`ЯМ ${label}: цена не рассчиталась (${tg.skips.join(', ')})`); continue; }
    const d = it.dimensions || {};
    const country = charVal(it, /страна/i) || 'Россия';
    offers.push({
      offer: {
        offerId,
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
      _price: { value: tg.ym.value, discountBase: tg.ym.discountBase, wbFinal: tg.wbFinal, subject: it.category },
      _wb: { barcode: String(it.barcode), stock: Number(it.stock) || 0, category: it.category, categoryName: cm.ym.name },
    });
  }
  return { offers, businessId: parseInt(getBusinessId()) };
}
