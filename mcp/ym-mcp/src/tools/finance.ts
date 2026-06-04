/**
 * Finance tools for Yandex Market MCP
 * Работа с балансом и выплатами
 */

import { z } from 'zod';

// ==================== Input Schemas ====================

export const GetBalanceInputSchema = z.object({
  campaignId: z.number().optional().describe('ID магазина (по умолчанию из env)'),
}).strict();

export const GetPaymentsInputSchema = z.object({
  campaignId: z.number().optional().describe('ID магазина (по умолчанию из env)'),
  dateFrom: z.string().describe('Дата начала (YYYY-MM-DD)'),
  dateTo: z.string().optional().describe('Дата конца (YYYY-MM-DD), по умолчанию сегодня'),
  limit: z.number().optional().default(100).describe('Максимальное количество записей'),
  pageToken: z.string().optional().describe('Токен для пагинации'),
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
  id: number;
  date: string;
  type: string;
  amount: number;
  orderId?: number;
  orderIds?: number[];
  paymentOrder?: {
    documentNumber?: string;
    date?: string;
  };
}

export interface PaymentsSummary {
  totalRecords: number;
  totalAmount: number;
  periodFrom: string;
  periodTo: string;
  byType: Record<string, { count: number; sum: number }>;
}

// ==================== Functions ====================

/**
 * Баланс продавца.
 *
 * У Яндекс.Маркета НЕТ прямого эндпоинта баланса по магазину
 * (`/campaigns/{id}/balance` отвечает NOT_FOUND). Финансовые данные доступны
 * только через Reports API (асинхронный финансовый отчёт) или личный кабинет.
 */
export async function getBalance(_input: GetBalanceInput): Promise<{
  balance: BalanceData;
}> {
  throw new Error(
    'Яндекс.Маркет не отдаёт баланс через прямой API. ' +
    'Финансы доступны через финансовый отчёт по реализации (Reports API) или личный кабинет seller.market.yandex.ru.'
  );
}

/**
 * История выплат.
 *
 * Прямого эндпоинта выплат у ЯМ нет (`/campaigns/{id}/account/statement` →
 * NOT_FOUND). Используйте Reports API (финансовый отчёт) или ЛК.
 */
export async function getPayments(_input: GetPaymentsInput): Promise<{
  payments: PaymentData[];
  summary: PaymentsSummary;
}> {
  throw new Error(
    'Яндекс.Маркет не отдаёт историю выплат через прямой API. ' +
    'Используйте финансовый отчёт по реализации (Reports API) или личный кабинет seller.market.yandex.ru.'
  );
}

// ==================== Formatters ====================

/**
 * Форматировать баланс как Markdown
 */
export function formatBalanceAsMarkdown(balance: BalanceData): string {
  const lines: string[] = [
    '## Баланс Яндекс.Маркет',
    '',
    `| Показатель | Значение |`,
    `|------------|----------|`,
    `| Баланс | ${balance.balance.toLocaleString('ru-RU')} ${balance.currency} |`,
    `| Обновлено | ${new Date(balance.updatedAt).toLocaleString('ru-RU')} |`,
    '',
    '> Для детальной информации о выплатах используйте `ym_get_payments`',
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
    '## Выписка Яндекс.Маркет',
    '',
    `**Период:** ${summary.periodFrom} — ${summary.periodTo}`,
    '',
    '### Сводка',
    '',
    `| Показатель | Значение |`,
    `|------------|----------|`,
    `| Записей | ${summary.totalRecords} |`,
    `| Общая сумма | ${summary.totalAmount.toLocaleString('ru-RU')} ₽ |`,
    '',
  ];

  // Группировка по типам
  if (Object.keys(summary.byType).length > 0) {
    lines.push('### По типам операций');
    lines.push('');
    lines.push('| Тип | Количество | Сумма |');
    lines.push('|-----|------------|-------|');

    for (const [type, data] of Object.entries(summary.byType)) {
      lines.push(`| ${type} | ${data.count} | ${data.sum.toLocaleString('ru-RU')} ₽ |`);
    }
    lines.push('');
  }

  // Список платежей
  if (payments.length > 0) {
    lines.push('### Последние операции');
    lines.push('');
    lines.push('| Дата | Тип | Сумма | Заказ |');
    lines.push('|------|-----|-------|-------|');

    for (const p of payments.slice(0, 30)) {
      const date = p.date?.split('T')[0] || '-';
      const type = p.type.length > 25 ? p.type.substring(0, 22) + '...' : p.type;
      const amount = p.amount.toLocaleString('ru-RU');
      const order = p.orderId || (p.orderIds?.length ? `${p.orderIds.length} заказов` : '-');

      lines.push(`| ${date} | ${type} | ${amount} ₽ | ${order} |`);
    }

    if (payments.length > 30) {
      lines.push('');
      lines.push(`> Показано 30 из ${payments.length} операций`);
    }
  }

  return lines.join('\n');
}
