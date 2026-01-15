/**
 * Finance tools for Wildberries MCP
 * Работа с балансом и выплатами
 */

import { z } from 'zod';
import { createWBHeaders, WB_API_URLS } from '../utils/auth.js';
import { logRead } from '../utils/logger.js';

// ==================== Input Schemas ====================

export const GetBalanceInputSchema = z.object({}).strict();

export const GetPaymentsInputSchema = z.object({
  dateFrom: z.string().describe('Дата начала (YYYY-MM-DD)'),
  dateTo: z.string().optional().describe('Дата конца (YYYY-MM-DD), по умолчанию сегодня'),
  limit: z.number().optional().default(100).describe('Максимальное количество записей'),
});

export type GetBalanceInput = z.infer<typeof GetBalanceInputSchema>;
export type GetPaymentsInput = z.infer<typeof GetPaymentsInputSchema>;

// ==================== Interfaces ====================

export interface BalanceData {
  balance: number;
  currency: string;
  updatedAt: string;
}

export interface PaymentData {
  realizationReportId: number;
  dateFrom: string;
  dateTo: string;
  createDate: string;
  supplierContractCode: string;
  rrdId: number;
  giId: number;
  subjectName: string;
  nmId: number;
  brandName: string;
  saName: string;
  tsName: string;
  barcode: string;
  docTypeName: string;
  quantity: number;
  retailPrice: number;
  retailAmount: number;
  salePercent: number;
  commissionPercent: number;
  officeName: string;
  supplierOperName: string;
  orderDate: string;
  saleDate: string;
  shkId: number;
  retailPriceWithDiscount: number;
  deliveryAmount: number;
  returnAmount: number;
  deliveryRub: number;
  giBoxTypeName: string;
  productDiscount: number;
  supplierPromo: number;
  rid: number;
  ppvzSppPrc: number;
  ppvzKvwPrcBase: number;
  ppvzKvwPrc: number;
  ppvzSalesCommission: number;
  ppvzForPay: number;
  ppvzReward: number;
  ppvzVw: number;
  ppvzVwNds: number;
  ppvzOfficeId: number;
  ppvzOfficeName: string;
  ppvzSupplierId: number;
  ppvzSupplierName: string;
  ppvzInn: string;
  declarationNumber: string;
  stickerId: string;
  bonusTypeName?: string;
  srid: string;
}

export interface PaymentsSummary {
  totalRecords: number;
  totalForPay: number;
  totalRetailAmount: number;
  totalCommission: number;
  totalDelivery: number;
  totalReturns: number;
  periodFrom: string;
  periodTo: string;
}

// ==================== Fetch Helper ====================

async function fetchWB<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...options,
    headers: {
      ...createWBHeaders(),
      ...options?.headers,
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`WB API Error ${response.status}: ${text}`);
  }

  if (response.status === 204) {
    return {} as T;
  }

  return response.json() as Promise<T>;
}

// ==================== Functions ====================

/**
 * Получить текущий баланс продавца
 */
export async function getBalance(_input: GetBalanceInput): Promise<{
  balance: BalanceData;
}> {
  // Используем Common API для информации о продавце
  const url = `${WB_API_URLS.common}/api/v1/seller/info`;

  interface SellerInfoResponse {
    name: string;
    sid: string;
    tradeMark?: string;
    countryId?: number;
    currencyCode?: string;
  }

  const sellerInfo = await fetchWB<SellerInfoResponse>(url);

  // Finance API для баланса (если доступен)
  let balance = 0;
  try {
    const balanceUrl = `${WB_API_URLS.statistics}/api/v5/supplier/incomes?dateFrom=${new Date().toISOString().split('T')[0]}`;
    const incomes = await fetchWB<Array<{ totalPrice: number }>>(balanceUrl);
    balance = incomes.reduce((sum, i) => sum + (i.totalPrice || 0), 0);
  } catch {
    // Баланс недоступен через этот API
  }

  const result = {
    balance: {
      balance,
      currency: sellerInfo.currencyCode || 'RUB',
      updatedAt: new Date().toISOString(),
    },
  };

  await logRead('wb_get_balance', 'finance', {}, result.balance);

  return result;
}

/**
 * Получить отчёт о выплатах (Report Detail)
 */
export async function getPayments(input: GetPaymentsInput): Promise<{
  payments: PaymentData[];
  summary: PaymentsSummary;
}> {
  const { dateFrom, dateTo, limit } = input;

  // Statistics API - детальный отчёт о реализации
  let url = `${WB_API_URLS.statistics}/api/v5/supplier/reportDetailByPeriod?dateFrom=${dateFrom}`;

  if (dateTo) {
    url += `&dateTo=${dateTo}`;
  } else {
    url += `&dateTo=${new Date().toISOString().split('T')[0]}`;
  }

  url += `&limit=${limit}&rrdid=0`;

  const result = await fetchWB<PaymentData[]>(url);

  const payments = result || [];

  // Рассчитываем сводку
  const summary: PaymentsSummary = {
    totalRecords: payments.length,
    totalForPay: payments.reduce((sum, p) => sum + (p.ppvzForPay || 0), 0),
    totalRetailAmount: payments.reduce((sum, p) => sum + (p.retailAmount || 0), 0),
    totalCommission: payments.reduce((sum, p) => sum + (p.ppvzSalesCommission || 0), 0),
    totalDelivery: payments.reduce((sum, p) => sum + (p.deliveryRub || 0), 0),
    totalReturns: payments.reduce((sum, p) => sum + (p.returnAmount || 0), 0),
    periodFrom: dateFrom,
    periodTo: dateTo || new Date().toISOString().split('T')[0],
  };

  await logRead('wb_get_payments', 'finance', input, {
    count: payments.length,
    totalForPay: summary.totalForPay,
  });

  return {
    payments,
    summary,
  };
}

// ==================== Formatters ====================

/**
 * Форматировать баланс как Markdown
 */
export function formatBalanceAsMarkdown(balance: BalanceData): string {
  const lines: string[] = [
    '## Баланс Wildberries',
    '',
    `| Показатель | Значение |`,
    `|------------|----------|`,
    `| Баланс | ${balance.balance.toLocaleString('ru-RU')} ${balance.currency} |`,
    `| Обновлено | ${new Date(balance.updatedAt).toLocaleString('ru-RU')} |`,
    '',
    '> Для детальной информации о выплатах используйте `wb_get_payments`',
  ];

  return lines.join('\n');
}

/**
 * Форматировать выплаты как Markdown
 */
export function formatPaymentsAsMarkdown(
  payments: PaymentData[],
  summary: PaymentsSummary
): string {
  const lines: string[] = [
    '## Отчёт о выплатах Wildberries',
    '',
    `**Период:** ${summary.periodFrom} — ${summary.periodTo}`,
    '',
    '### Сводка',
    '',
    `| Показатель | Значение |`,
    `|------------|----------|`,
    `| Записей | ${summary.totalRecords} |`,
    `| К перечислению | ${summary.totalForPay.toLocaleString('ru-RU')} ₽ |`,
    `| Розничная сумма | ${summary.totalRetailAmount.toLocaleString('ru-RU')} ₽ |`,
    `| Комиссия WB | ${summary.totalCommission.toLocaleString('ru-RU')} ₽ |`,
    `| Логистика | ${summary.totalDelivery.toLocaleString('ru-RU')} ₽ |`,
    `| Возвраты | ${summary.totalReturns.toLocaleString('ru-RU')} ₽ |`,
    '',
  ];

  if (payments.length > 0) {
    // Группируем по отчётам
    const reportGroups = new Map<number, PaymentData[]>();
    for (const p of payments) {
      const existing = reportGroups.get(p.realizationReportId) || [];
      existing.push(p);
      reportGroups.set(p.realizationReportId, existing);
    }

    lines.push('### Отчёты о реализации');
    lines.push('');
    lines.push('| ID отчёта | Период | Записей | К перечислению |');
    lines.push('|-----------|--------|---------|----------------|');

    for (const [reportId, items] of reportGroups) {
      const first = items[0];
      const forPay = items.reduce((sum, p) => sum + (p.ppvzForPay || 0), 0);
      const period = `${first.dateFrom?.split('T')[0] || '-'} — ${first.dateTo?.split('T')[0] || '-'}`;
      lines.push(`| ${reportId} | ${period} | ${items.length} | ${forPay.toLocaleString('ru-RU')} ₽ |`);
    }

    lines.push('');

    // Топ товаров по выручке
    const productSums = new Map<number, { name: string; amount: number; forPay: number }>();
    for (const p of payments) {
      const existing = productSums.get(p.nmId) || { name: p.subjectName, amount: 0, forPay: 0 };
      existing.amount += p.retailAmount || 0;
      existing.forPay += p.ppvzForPay || 0;
      productSums.set(p.nmId, existing);
    }

    const topProducts = Array.from(productSums.entries())
      .sort((a, b) => b[1].forPay - a[1].forPay)
      .slice(0, 10);

    if (topProducts.length > 0) {
      lines.push('### Топ-10 товаров по выплатам');
      lines.push('');
      lines.push('| nmId | Название | Розница | К перечислению |');
      lines.push('|------|----------|---------|----------------|');

      for (const [nmId, data] of topProducts) {
        const name = data.name.length > 30 ? data.name.substring(0, 27) + '...' : data.name;
        lines.push(`| ${nmId} | ${name} | ${data.amount.toLocaleString('ru-RU')} ₽ | ${data.forPay.toLocaleString('ru-RU')} ₽ |`);
      }
    }
  }

  return lines.join('\n');
}
