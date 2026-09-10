/**
 * Ценовая модель «единая база + скидки по комиссиям» (2026-07-16, заменяет режим A).
 *
 * Якорь — витринная цена WB (discountedPrice), она никогда не меняется.
 * Единая цена до скидки (база B) на всех трёх площадках: WB price / Ozon old_price / ЯМ discountBase.
 * Финалка площадки — полная компенсация комиссий: одинаковое нетто с продажи везде.
 *
 *   net      = wb_final × (1 − take_wb)
 *   final_mp = roundUp10( net / (1 − take_mp) )
 *   B        = наименьшая база ≥ требуемого минимума, при которой WB-скидка целая
 *              и B×(1−d_wb/100) == wb_final (WB принимает только integer %)
 *
 * Чистый модуль без I/O — вся логика юнит-тестируема.
 */

export interface SubjectRates {
  take_wb: number | null;   // доля, комиссия WB (kgvpMarketplace FBS) + эквайринг
  take_ozon: number | null; // доля, sales_percent_fbs + acquiring (фолбэк, если нет live per-SKU)
  take_ym: number | null;   // доля, FEE + AGENCY_COMMISSION + PAYMENT_TRANSFER
}

export interface BasePolicy {
  d_headroom: number;            // запас скидки на самой дорогой площадке (0.15)
  round_base_to: number;         // шаг «красивого» ориентира базы (100)
  min_discount_pct: number;      // минимальная скидка на любой площадке (Ozon/ЯМ требуют ≥5)
  wb_min_discount_pct: number;   // нижняя граница WB-скидки (3)
  wb_max_discount_pct: number;   // верхняя граница WB-скидки (95)
  ozon_min_discount_rub: number; // Ozon: old_price − price ≥ N₽ (500)
  ozon_min_price_factor: number; // min_price = final_oz × factor (0.95)
  final_price_ending?: number | null; // «психологическое» окончание финалок зеркал (90 → ...90/...990); null/нет — roundUp10
}

export interface TargetInput {
  barcode: string;
  nmId: number;
  vendorCode: string;
  category: string;
  title: string;
  wbFinal: number;             // витринная WB, integer ₽ — якорь
  ozonOfferId?: string;        // резолвлен по barcode → vendorCode; undefined = нет линка
  ymOfferId?: string;
  liveOzonTakeFbs?: number;    // доля, sales_percent_fbs+acquiring живого SKU (приоритетнее by_subject)
}

export interface PriceTarget {
  barcode: string;
  nmId: number;
  vendorCode: string;
  category: string;
  title: string;
  wbFinal: number;
  base: number;                                                        // единая цена до скидки
  wb: { price: number; discount: number; exact: boolean } | null;      // null = нет nmId
  ozon: { offerId: string; price: number; oldPrice: number; minPrice: number; discountPct: number } | null;
  ym: { offerId: string; value: number; discountBase: number; discountPct: number } | null;
  payouts: { net: number; wb: number; ozon?: number; ym?: number };    // проверка эквивалентности
  skips: string[];                                                     // причины пропусков (площадка/позиция)
}

export const roundUp10 = (n: number): number => Math.ceil(n / 10) * 10;
export const ceilTo = (step: number, n: number): number => Math.ceil(n / step) * step;
// Наименьшая цена ≥ n с окончанием ending в сотне (ending=90: 9 840 → 9 890, 9 891 → 9 990)
export const roundUpEnding = (n: number, ending: number): number =>
  Math.ceil((n - ending) / 100) * 100 + ending;

/**
 * Подбор базы и целой WB-скидки: наименьший d ≥ dStart, при котором база делится нацело
 * (B×(100−d) == wbFinal×100) — тогда витринная WB не сдвигается ни на копейку.
 * Фолбэк (нет точного делителя до maxD): округлённая база, финалка может уехать на ≤1₽ —
 * ловится верификацией после записи.
 */
export function fitBase(
  wbFinal: number,
  requiredMin: number,
  minD: number,
  maxD: number
): { base: number; discount: number; exact: boolean } {
  const dStart = Math.max(minD, Math.ceil(100 * (1 - wbFinal / requiredMin)));
  for (let d = dStart; d <= maxD; d++) {
    if ((wbFinal * 100) % (100 - d) === 0) {
      return { base: (wbFinal * 100) / (100 - d), discount: d, exact: true };
    }
  }
  const d = Math.min(dStart, maxD);
  return { base: Math.round((wbFinal * 100) / (100 - d)), discount: d, exact: false };
}

export function computeTarget(it: TargetInput, rates: SubjectRates | null, policy: BasePolicy): PriceTarget {
  const skips: string[] = [];
  const out: PriceTarget = {
    barcode: it.barcode, nmId: it.nmId, vendorCode: it.vendorCode,
    category: it.category, title: it.title, wbFinal: it.wbFinal,
    base: 0, wb: null, ozon: null, ym: null,
    payouts: { net: 0, wb: 0 }, skips,
  };

  if (!it.wbFinal || it.wbFinal <= 0) { skips.push('no-wb-final'); return out; }
  if (!rates || rates.take_wb == null) { skips.push('no-rates:' + (it.category || '?')); return out; }

  const takeWb = rates.take_wb;
  const takeOz = it.liveOzonTakeFbs ?? rates.take_ozon;
  const takeYm = rates.take_ym;

  const net = it.wbFinal * (1 - takeWb);
  out.payouts.net = Math.round(net);

  // Целевые финалки зеркал (полная компенсация комиссий); излишек округления падает в нетто
  const roundFinal = (x: number): number =>
    policy.final_price_ending != null ? roundUpEnding(x, policy.final_price_ending) : roundUp10(x);

  let finalOz = 0;
  if (!it.ozonOfferId) skips.push('no-ozon-link');
  else if (takeOz == null) skips.push('no-ozon-rate:' + (it.category || '?'));
  else finalOz = roundFinal(net / (1 - takeOz));

  let finalYm = 0;
  if (!it.ymOfferId) skips.push('no-ym-link');
  else if (takeYm == null) skips.push('no-ym-rate:' + (it.category || '?'));
  else finalYm = roundFinal(net / (1 - takeYm));

  // Требуемый минимум базы: запас d_headroom над самой дорогой финалкой,
  // минимальная процентная скидка на каждой площадке, рублёвый минимум скидки Ozon.
  const finalMax = Math.max(it.wbFinal, finalOz, finalYm);
  const minFrac = 1 - policy.min_discount_pct / 100;
  let requiredMin = finalMax / (1 - policy.d_headroom);
  if (finalOz) requiredMin = Math.max(requiredMin, finalOz + policy.ozon_min_discount_rub, finalOz / minFrac);
  if (finalYm) requiredMin = Math.max(requiredMin, finalYm / minFrac);
  requiredMin = ceilTo(policy.round_base_to, requiredMin);

  const fit = fitBase(it.wbFinal, requiredMin, policy.wb_min_discount_pct, policy.wb_max_discount_pct);
  out.base = fit.base;

  if (fit.base < requiredMin) {
    // wb_max_discount_pct не позволил вместить требуемую базу (аномально дорогое зеркало)
    skips.push('base-overflow');
    return out;
  }

  out.wb = it.nmId ? { price: fit.base, discount: fit.discount, exact: fit.exact } : null;
  if (!it.nmId) skips.push('no-wb-nmid');
  out.payouts.wb = Math.round(it.wbFinal * (1 - takeWb));

  if (finalOz && it.ozonOfferId && takeOz != null) {
    // страховка: финалка не выше базы с минимальной скидкой (по построению requiredMin — выполняется)
    const discountPct = Math.round((1 - finalOz / fit.base) * 100);
    out.ozon = {
      offerId: it.ozonOfferId,
      price: finalOz,
      oldPrice: fit.base,
      minPrice: Math.round(finalOz * policy.ozon_min_price_factor),
      discountPct,
    };
    out.payouts.ozon = Math.round(finalOz * (1 - takeOz));
  }

  if (finalYm && it.ymOfferId && takeYm != null) {
    const discountPct = Math.round((1 - finalYm / fit.base) * 100);
    if (discountPct < 1 || discountPct > 99) {
      skips.push('ym-discount-out-of-range:' + discountPct);
    } else {
      out.ym = { offerId: it.ymOfferId, value: finalYm, discountBase: fit.base, discountPct };
      out.payouts.ym = Math.round(finalYm * (1 - takeYm));
    }
  }

  return out;
}
