/**
 * Подкоманда `prices` — отчёт по дрейфу цен (режим A vs факт). Без мутаций.
 * Цель площадки = round10(WB_finalPrice × k_площадки). Если |факт − расч|/расч > порога — в алерт.
 */
import { listWbInStock, listOzonPrices, listYmPrices } from '../clients.js';
import { pricing, GUARD } from '../config.js';
import { log } from '../log.js';
import { notify, alertBlock } from '../notify.js';

const round10 = (n: number): number => Math.ceil(n / 10) * 10;
const pct = (a: number, t: number): string => (a > t ? '+' : '') + Math.round(((a - t) / t) * 100) + '%';

export async function runPrices(): Promise<void> {
  log('=== prices (report-only) ===');
  const [wb, ozP, ymP] = await Promise.all([listWbInStock(), listOzonPrices(), listYmPrices()]);
  const by = (pricing as any).by_subject;
  const thr = GUARD.price_drift_alert_pct / 100;
  const drifts: string[] = [];

  for (const it of wb) {
    const pr = by[it.category || ''] || by['Подвески бижутерные'];
    if (!pr) continue;
    const fp = it.finalPrice || 0;
    if (!fp) continue;
    const name = (it.title || '').slice(0, 24);

    const tOz = round10(fp * pr.k_ozon);
    const aOz = ozP.get(it.barcode);
    if (aOz && Math.abs(aOz - tOz) / tOz > thr) drifts.push(`Ozon ${it.barcode} ${name}: факт ${aOz} vs расч ${tOz} (${pct(aOz, tOz)})`);

    const tYm = round10(fp * pr.k_ym);
    const aYm = ymP.get(it.barcode);
    if (aYm && Math.abs(aYm - tYm) / tYm > thr) drifts.push(`ЯМ ${it.barcode} ${name}: факт ${aYm} vs расч ${tYm} (${pct(aYm, tYm)})`);
  }

  log(`дрейф цен (> ${GUARD.price_drift_alert_pct}%): ${drifts.length}`);
  for (const d of drifts.slice(0, 40)) log('  · ' + d);
  if (drifts.length) {
    await notify(alertBlock(`💰 Дрейф цен (режим A, порог ${GUARD.price_drift_alert_pct}%)`, drifts.slice(0, 30)));
  } else {
    log('расхождений выше порога нет');
  }
}
