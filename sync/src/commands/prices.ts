/**
 * Подкоманда `prices` — модель «единая база + скидки по комиссиям» (v2, 2026-07-16).
 *
 * Режимы:
 *   prices                    — отчёт дрейфа (факт витрин vs целевые), без мутаций;
 *   prices --preview          — reports/reprice-<дата>.csv + .md (БЫЛО→СТАЛО), без мутаций;
 *   prices --apply [bc ...]   — запись цен WB→Ozon→ЯМ (позиционные barcode = фильтр smoke-прогона).
 *
 * Якорь — витринная WB (не меняется). WB пишем базу+скидку, Ozon price/old_price/min_price,
 * ЯМ value+discountBase. Анти-флаппинг: пишем только при дрейфе > price_min_change_pct.
 */
import {
  listWbInStock, listOzonPriceInfo, listYmPriceInfo, listWbQuarantine,
  writeWbPrices, writeOzonPrices, writeYmPrices,
  type WbItem, type OzonPriceInfo, type YmPriceInfo,
} from '../clients.js';
import { computeTarget, type PriceTarget, type BasePolicy, type SubjectRates } from '../pricing.js';
import { pricing, syncConfig, GUARD, SKIP_OZON, STATE_DIR, ROOT } from '../config.js';
import { log } from '../log.js';
import { notify, alertBlock } from '../notify.js';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

export interface PricesOpts { apply?: boolean; preview?: boolean; only?: string[] }

interface ItemPlan {
  t: PriceTarget;
  cur: { wbBase: number; wbDisc: number; oz?: OzonPriceInfo; ym?: YmPriceInfo };
  // что реально писать (после анти-флаппинга/капов); undefined = не трогаем
  doWb?: { nmID: number; price: number; discount: number };
  doOz?: { offer_id: string; price: string; old_price: string; min_price: string; vat: string };
  doYm?: { offerId: string; value: number; discountBase?: number };
  alerts: string[];
}

const STATE_PATH = () => resolve(STATE_DIR, 'prices-state.json');
const driftPct = (cur: number, target: number): number => (cur > 0 ? Math.abs(cur - target) / cur * 100 : Infinity);

export async function runPrices(opts: PricesOpts = {}): Promise<void> {
  const mode = opts.apply ? 'apply' : opts.preview ? 'preview' : 'report';
  log(`=== prices (${mode}) — модель v2 «единая база + скидки по комиссиям» ===`);

  const policy: BasePolicy = pricing.base_policy;
  const gr = pricing.guardrails || {};
  const bySubject: Record<string, SubjectRates> = pricing.by_subject || {};
  const ozAcqFallback: number = pricing.acquiring?.ozon_median ?? 0.015;

  const [wb, ozP, ymP] = await Promise.all([listWbInStock(), listOzonPriceInfo(), listYmPriceInfo()]);
  let quarantine = new Set<number>();
  try {
    quarantine = await listWbQuarantine();
  } catch (e) {
    quarantine = new Set<number>((syncConfig.sync.wb_price_quarantine_nmids as number[]) || []);
    log(`⚠️ карантин WB недоступен (${(e as Error).message.slice(0, 80)}) — ручной список из sync-config: ${quarantine.size}`);
  }
  log(`WB in-stock: ${wb.length} · Ozon цен: ${ozP.size} · ЯМ цен: ${ymP.size} · карантин WB: ${quarantine.size}`);

  const skipOzon = new Set(SKIP_OZON);
  const only = opts.only?.length ? new Set(opts.only) : null;
  const plans: ItemPlan[] = [];
  const skippedGlobal: string[] = [];

  for (const it of wb) {
    if (only && !only.has(it.barcode)) continue;

    const rates = bySubject[it.category || ''] ?? null;
    const ozKey = skipOzon.has(it.barcode) ? undefined
      : ozP.has(it.barcode) ? it.barcode
      : ozP.has(it.vendorCode) ? it.vendorCode : undefined;
    const oz = ozKey ? ozP.get(ozKey) : undefined;
    const ym = ymP.get(it.barcode);

    // live-ставка Ozon per-SKU: sales_percent_fbs + эквайринг (доля от текущей витринной)
    let liveOzonTake: number | undefined;
    if (oz && oz.salesPercentFbs > 0) {
      const acqPct = oz.acquiring > 0 && oz.marketing > 0 ? oz.acquiring / oz.marketing : ozAcqFallback;
      liveOzonTake = oz.salesPercentFbs / 100 + acqPct;
    }

    const t = computeTarget(
      {
        barcode: it.barcode, nmId: it.nmId, vendorCode: it.vendorCode,
        category: it.category || '', title: it.title || '',
        wbFinal: it.finalPrice || 0,
        ozonOfferId: ozKey, ymOfferId: ym ? it.barcode : undefined,
        liveOzonTakeFbs: liveOzonTake,
      },
      rates, policy
    );

    const plan: ItemPlan = { t, cur: { wbBase: it.price || 0, wbDisc: it.discount || 0, oz, ym }, alerts: [] };
    if (skipOzon.has(it.barcode)) t.skips.push('skip-ozon-list');

    // --- решения о записи (анти-флаппинг + капы) ---
    const minChange = gr.price_min_change_pct ?? 2;
    const maxChange = gr.price_max_change_pct ?? 60;

    if (t.wb) {
      if (quarantine.has(t.nmId)) {
        t.skips.push('wb-quarantine');
      } else {
        const baseDrift = driftPct(plan.cur.wbBase, t.wb.price);
        if (baseDrift > minChange || plan.cur.wbDisc !== t.wb.discount) {
          plan.doWb = { nmID: t.nmId, price: t.wb.price, discount: t.wb.discount };
        }
      }
    }

    if (t.ozon && oz) {
      const drift = driftPct(oz.marketing, t.ozon.price);
      if (oz.marketing > 0 && drift > maxChange) {
        plan.alerts.push(`Ozon «${t.title.slice(0, 30)}»: изменение ${Math.round(drift)}% выше капа ${maxChange}% (${oz.marketing}→${t.ozon.price}) — пропуск`);
        t.skips.push('ozon-cap');
      } else if (drift > minChange || driftPct(oz.oldPrice, t.ozon.oldPrice) > minChange || oz.minPrice !== t.ozon.minPrice) {
        plan.doOz = {
          offer_id: t.ozon.offerId,
          price: String(t.ozon.price),
          old_price: String(t.ozon.oldPrice),
          min_price: String(t.ozon.minPrice),
          vat: oz.vat || '0',
        };
      }
    }

    if (t.ym && ym) {
      const drift = driftPct(ym.price, t.ym.value);
      if (ym.price > 0 && drift > maxChange) {
        plan.alerts.push(`ЯМ «${t.title.slice(0, 30)}»: изменение ${Math.round(drift)}% выше капа ${maxChange}% (${ym.price}→${t.ym.value}) — пропуск`);
        t.skips.push('ym-cap');
      } else if (drift > minChange || driftPct(ym.discountBase || 0, t.ym.discountBase) > minChange) {
        plan.doYm = { offerId: t.ym.offerId, value: t.ym.value, discountBase: t.ym.discountBase };
      }
    }

    plans.push(plan);
    if (t.skips.length) skippedGlobal.push(`${it.barcode} ${String(it.title || '').slice(0, 22)}: ${t.skips.join(',')}`);
  }

  const nWb = plans.filter((p) => p.doWb).length;
  const nOz = plans.filter((p) => p.doOz).length;
  const nYm = plans.filter((p) => p.doYm).length;
  log(`изменения: WB ${nWb} · Ozon ${nOz} · ЯМ ${nYm} · пропусков ${skippedGlobal.length}`);

  if (mode === 'report') return reportDrift(plans);
  if (mode === 'preview') return writePreview(plans, skippedGlobal, { nWb, nOz, nYm });
  return applyPlans(plans, skippedGlobal, { nWb, nOz, nYm }, gr);
}

// ---------- report: дрейф факт vs цель (замена старого отчёта, для cron до включения apply) ----------
function reportDrift(plans: ItemPlan[]): void {
  const thr = GUARD.price_drift_alert_pct;
  const drifts: string[] = [];
  for (const p of plans) {
    const name = p.t.title.slice(0, 24);
    if (p.t.ozon && p.cur.oz?.marketing) {
      const d = driftPct(p.cur.oz.marketing, p.t.ozon.price);
      if (d > thr) drifts.push(`Ozon ${p.t.barcode} ${name}: факт ${p.cur.oz.marketing} vs цель ${p.t.ozon.price} (${Math.round(d)}%)`);
    }
    if (p.t.ym && p.cur.ym?.price) {
      const d = driftPct(p.cur.ym.price, p.t.ym.value);
      if (d > thr) drifts.push(`ЯМ ${p.t.barcode} ${name}: факт ${p.cur.ym.price} vs цель ${p.t.ym.value} (${Math.round(d)}%)`);
    }
  }
  log(`дрейф цен (> ${thr}%): ${drifts.length}`);
  for (const d of drifts.slice(0, 40)) log('  · ' + d);
}

// ---------- preview: CSV + MD ----------
function writePreview(plans: ItemPlan[], skipped: string[], n: { nWb: number; nOz: number; nYm: number }): void {
  const date = new Date().toISOString().slice(0, 10);
  const dir = resolve(ROOT, 'reports');
  mkdirSync(dir, { recursive: true });

  const head = [
    'barcode', 'nmId', 'категория', 'товар', 'WB_витрина_неизм',
    'WB_база_было', 'WB_база_стало', 'WB_скидка_было', 'WB_скидка_стало',
    'Ozon_было', 'Ozon_стало', 'Ozon_скидка_%', 'Ozon_min',
    'ЯМ_было', 'ЯМ_стало', 'ЯМ_скидка_%',
    'Δ_Ozon_%', 'Δ_ЯМ_%', 'нетто_WB', 'нетто_Ozon', 'нетто_ЯМ', 'пропуски',
  ].join(';');
  const rows = plans.map((p) => {
    const t = p.t;
    const ozCur = p.cur.oz?.marketing || '';
    const ymCur = p.cur.ym?.price || '';
    const dOz = t.ozon && p.cur.oz?.marketing ? Math.round((t.ozon.price / p.cur.oz.marketing - 1) * 100) : '';
    const dYm = t.ym && p.cur.ym?.price ? Math.round((t.ym.value / p.cur.ym.price - 1) * 100) : '';
    return [
      t.barcode, t.nmId, t.category, '"' + t.title.replace(/"/g, "'").slice(0, 60) + '"', t.wbFinal,
      p.cur.wbBase, t.wb?.price ?? '', p.cur.wbDisc, t.wb?.discount ?? '',
      ozCur, t.ozon?.price ?? '', t.ozon?.discountPct ?? '', t.ozon?.minPrice ?? '',
      ymCur, t.ym?.value ?? '', t.ym?.discountPct ?? '',
      dOz, dYm, t.payouts.wb, t.payouts.ozon ?? '', t.payouts.ym ?? '', t.skips.join(','),
    ].join(';');
  });
  const csvPath = resolve(dir, `reprice-${date}.csv`);
  writeFileSync(csvPath, '﻿' + head + '\n' + rows.join('\n') + '\n');

  // сводка по категориям + проверка эквивалентности выплат
  const byCat = new Map<string, { n: number; dOz: number[]; dYm: number[] }>();
  let maxPayoutDev = 0;
  for (const p of plans) {
    const c = byCat.get(p.t.category) || { n: 0, dOz: [], dYm: [] };
    c.n++;
    if (p.t.ozon && p.cur.oz?.marketing) c.dOz.push((p.t.ozon.price / p.cur.oz.marketing - 1) * 100);
    if (p.t.ym && p.cur.ym?.price) c.dYm.push((p.t.ym.value / p.cur.ym.price - 1) * 100);
    byCat.set(p.t.category, c);
    for (const v of [p.t.payouts.ozon, p.t.payouts.ym]) {
      if (v != null) maxPayoutDev = Math.max(maxPayoutDev, Math.abs(v - p.t.payouts.net));
    }
  }
  const avg = (a: number[]) => (a.length ? Math.round(a.reduce((s, x) => s + x, 0) / a.length) : null);
  const mdLines = [
    `# Reprice preview ${date} — единая база + скидки по комиссиям`,
    '',
    `Позиции WB in-stock: ${plans.length}. Изменения: WB ${n.nWb} · Ozon ${n.nOz} · ЯМ ${n.nYm}.`,
    `Максимальное отклонение выплаты от целевой (нетто WB): ${Math.round(maxPayoutDev)}₽.`,
    '',
    '| Категория | шт | средний Δ Ozon | средний Δ ЯМ |',
    '|---|---|---|---|',
    ...[...byCat.entries()].map(([cat, c]) => `| ${cat} | ${c.n} | ${avg(c.dOz) ?? '—'}% | ${avg(c.dYm) ?? '—'}% |`),
    '',
    `## Пропуски (${skipped.length})`,
    ...skipped.map((s) => '- ' + s),
  ];
  const mdPath = resolve(dir, `reprice-${date}.md`);
  writeFileSync(mdPath, mdLines.join('\n') + '\n');

  log(`preview: ${csvPath}`);
  log(`preview: ${mdPath}`);
}

// ---------- apply ----------
async function applyPlans(
  plans: ItemPlan[], skipped: string[],
  n: { nWb: number; nOz: number; nYm: number }, gr: any
): Promise<void> {
  const totalChanges = n.nWb + n.nOz + n.nYm;
  const abortOver = gr.prices_abort_if_changes_over ?? 400;
  if (totalChanges > abortOver) {
    log(`🔴 аномально много ценовых изменений (${totalChanges} > ${abortOver}) — не применяю.`);
    await notify(
      alertBlock('🔴 Обновление цен остановлено защитой', [
        `Слишком много изменений за раз: ${totalChanges} при лимите ${abortOver}.`,
        'Цены не тронуты. Так бывает при сильном сдвиге витрин WB (автоакции) или ошибке модели.',
        'Сначала посмотрите отчёт без применения (prices), потом запускайте вручную.',
      ]),
    );
    return;
  }
  if (!totalChanges) {
    log('изменений нет — всё выровнено.');
    return;
  }

  const alerts: string[] = plans.flatMap((p) => p.alerts);

  // 1. WB: база + скидка (витринная не меняется)
  const wbRows = plans.filter((p) => p.doWb).map((p) => p.doWb!);
  let wbRes = { ok: 0, errors: [] as string[] };
  if (wbRows.length) {
    wbRes = await writeWbPrices(wbRows);
    log(`WB: применено ${wbRes.ok}/${wbRows.length}${wbRes.errors.length ? ' · ошибки: ' + wbRes.errors.join(' | ') : ''}`);
  }

  // 2. Верификация WB: подождать обработку task и сверить, что витринная не сдвинулась
  if (wbRows.length && wbRes.ok > 0) {
    await new Promise((r) => setTimeout(r, 30000));
    try {
      const wbAfter = await listWbInStock();
      const byBc = new Map(wbAfter.map((w) => [w.barcode, w]));
      let moved = 0;
      for (const p of plans.filter((x) => x.doWb)) {
        const after = byBc.get(p.t.barcode);
        if (after?.finalPrice && Math.abs(after.finalPrice - p.t.wbFinal) > 1) {
          moved++;
          alerts.push(`⚠️ WB «${p.t.title.slice(0, 30)}»: витрина сдвинулась ${p.t.wbFinal}→${after.finalPrice} (ожидалась неизменной)`);
        }
      }
      log(`WB верификация: витринная сдвинулась у ${moved} позиций (допуск ±1₽; задача могла ещё примениться не вся)`);
    } catch (e) {
      log(`⚠️ WB верификация не удалась: ${(e as Error).message.slice(0, 100)}`);
    }
  }

  // 3. Ozon
  const ozRows = plans.filter((p) => p.doOz).map((p) => p.doOz!);
  let ozRes = { ok: 0, errors: [] as string[] };
  if (ozRows.length) {
    ozRes = await writeOzonPrices(ozRows);
    log(`Ozon: применено ${ozRes.ok}/${ozRows.length}${ozRes.errors.length ? ' · reject: ' + ozRes.errors.slice(0, 10).join(' | ') : ''}`);
  }

  // 4. ЯМ
  const ymRows = plans.filter((p) => p.doYm).map((p) => p.doYm!);
  let ymRes = { ok: 0, errors: [] as string[] };
  if (ymRows.length) {
    ymRes = await writeYmPrices(ymRows);
    log(`ЯМ: применено ${ymRes.ok}/${ymRows.length}${ymRes.errors.length ? ' · ошибки: ' + ymRes.errors.slice(0, 5).join(' | ') : ''}`);
  }

  // 5. State (история применений)
  try {
    mkdirSync(STATE_DIR, { recursive: true });
    let state: any = {};
    try { state = JSON.parse(readFileSync(STATE_PATH(), 'utf8')); } catch { /* первого запуска нет */ }
    const now = new Date().toISOString();
    for (const p of plans) {
      if (!p.doWb && !p.doOz && !p.doYm) continue;
      state[p.t.barcode] = {
        appliedAt: now, base: p.t.base, wbFinal: p.t.wbFinal,
        wb: p.doWb ?? null, oz: p.doOz ? { price: p.doOz.price, old: p.doOz.old_price } : null,
        ym: p.doYm ?? null,
      };
    }
    writeFileSync(STATE_PATH(), JSON.stringify(state, null, 2));
  } catch (e) {
    log(`⚠️ prices-state не сохранён: ${(e as Error).message.slice(0, 80)}`);
  }

  // 6. Итог в Telegram — только если были изменения/ошибки (не спамим). Формат утв. 2026-07-19.
  const errCount = wbRes.errors.length + ozRes.errors.length + ymRes.errors.length;
  // в ошибках подставляем название товара вместо баркода/артикула, если он известен плану
  const titleByKey = new Map<string, string>();
  for (const p of plans) {
    titleByKey.set(p.t.barcode, p.t.title);
    if (p.t.ozon) titleByKey.set(p.t.ozon.offerId, p.t.title);
    if (p.t.ym) titleByKey.set(p.t.ym.offerId, p.t.title);
  }
  const humanize = (s: string): string => {
    const tok = s.split(/[:\s]/)[0];
    const t = titleByKey.get(tok);
    return t ? s.replace(tok, `«${t.slice(0, 30)}»`) : s;
  };
  const lines = errCount
    ? [`Применено: WB ${wbRes.ok}/${wbRows.length} · Ozon ${ozRes.ok}/${ozRows.length} · ЯМ ${ymRes.ok}/${ymRows.length}`,
       'Ошибки:', ...[...wbRes.errors, ...ozRes.errors, ...ymRes.errors].slice(0, 12).map(humanize)]
    : [`Изменено: WB ${wbRes.ok} · Ozon ${ozRes.ok} · ЯМ ${ymRes.ok} — всё применено`];
  if (alerts.length) lines.push(...alerts.slice(0, 10).map(humanize));
  if (skipped.length) lines.push(`Пропущено: ${skipped.length} (ценовой карантин WB и правила модели — см. лог)`);
  await notify(alertBlock(errCount ? '💰 Цены обновлены, есть ошибки ⚠️' : '💰 Цены обновлены', lines));
}
