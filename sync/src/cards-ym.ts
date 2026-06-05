/**
 * Сборка ЯМ offer-payload для авто-создания недостающих карточек (порт cards-ym.mjs в TS).
 * Категория из category-map (бижутерия/сувениры, ювелирка исключена). Санитайзер режет
 * оригинальность/качество + CJK/спецсимволы. Цена — k_ym (режим A) ставится отдельно.
 */
import { getProductsInStock } from '../../mcp/wb-mcp/dist/tools/products-in-stock.js';
import { getProducts as ymGetProducts } from '../../mcp/ym-mcp/dist/tools/products.js';
import { getBusinessId } from '../../mcp/ym-mcp/dist/api/client.js';
import { categoryMap, pricing } from './config.js';

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
  _price: { finalP: number; baseP: number; k: number; subject: string };
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

export async function buildYmCards(opts: { offerIds?: string[] } = {}): Promise<{ offers: YmOfferBuilt[]; businessId: number }> {
  const catMap = (categoryMap as any).map;
  const priceBy = (pricing as any).by_subject;

  const wb: any = await getProductsInStock({ minQuantity: 1 });
  let ym: any[] = [];
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
    ? wb.products.filter((p: any) => want.has(String(p.barcode)))
    : wb.products.filter((p: any) => !ymIds.has(String(p.barcode)));

  const offers: YmOfferBuilt[] = [];
  for (const it of targets) {
    const cm = catMap[it.category];
    if (!cm || cm.excluded || !cm.ym || !cm.ym.marketCategoryId) continue;
    const d = it.dimensions || {};
    const country = charVal(it, /страна/i) || 'Россия';
    const pr = priceBy[it.category] || priceBy['Подвески бижутерные'];
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
  return { offers, businessId: parseInt(getBusinessId()) };
}
