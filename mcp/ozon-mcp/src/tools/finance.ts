/**
 * Finance tools for Ozon MCP
 * Работа с балансом и транзакциями
 */

import { z } from 'zod';
import { createOzonHeaders, OZON_API_URL } from '../utils/auth.js';
import { logRead } from '../utils/logger.js';

// ==================== Input Schemas ====================

export const GetBalanceInputSchema = z.object({}).strict();

export const GetTransactionsInputSchema = z.object({
  dateFrom: z.string().describe('Дата начала (YYYY-MM-DDTHH:mm:ss.000Z или YYYY-MM-DD)'),
  dateTo: z.string().optional().describe('Дата конца, по умолчанию сегодня'),
  transactionType: z.enum([
    'all', // все
    'orders', // заказы
    'returns', // возвраты
    'services', // услуги
    'deposit', // пополнение
    'other', // прочее
  ]).optional().default('all').describe('Тип транзакций'),
  page: z.number().optional().default(1).describe('Номер страницы'),
  pageSize: z.number().optional().default(100).describe('Записей на странице (макс 1000)'),
});

export type GetBalanceInput = z.infer<typeof GetBalanceInputSchema>;
export type GetTransactionsInput = z.infer<typeof GetTransactionsInputSchema>;

// ==================== Interfaces ====================

export interface BalanceData {
  balance: number;
  currency: string;
  updatedAt: string;
}

export interface TransactionData {
  operationId: number;
  operationType: string;
  operationTypeName: string;
  operationDate: string;
  postingNumber: string;
  accrualAmount: number;
  saleAmount: number;
  items: Array<{
    name: string;
    sku: number;
  }>;
  services: Array<{
    name: string;
    price: number;
  }>;
}

export interface TransactionsSummary {
  totalRecords: number;
  totalAccrual: number;
  totalSale: number;
  periodFrom: string;
  periodTo: string;
  byType: Record<string, { count: number; sum: number }>;
}

// ==================== Fetch Helper ====================

async function fetchOzon<T>(
  endpoint: string,
  body: Record<string, unknown>
): Promise<T> {
  const response = await fetch(`${OZON_API_URL}${endpoint}`, {
    method: 'POST',
    headers: createOzonHeaders(),
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Ozon API Error ${response.status}: ${text}`);
  }

  return response.json() as Promise<T>;
}

// ==================== Functions ====================

/**
 * Получить текущий баланс продавца
 * POST /v1/finance/cash-flow-statement/list
 */
export async function getBalance(_input: GetBalanceInput): Promise<{
  balance: BalanceData;
}> {
  // Получаем данные за последний месяц для расчёта баланса
  const now = new Date();
  const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  // Ozon не отдаёт «текущий баланс» напрямую — берём итог денежного потока
  // (cash-flow-statement) за период. Эндпоинт требует page > 0.
  const result = await fetchOzon<{
    result: {
      cash_flows: Array<{
        period: { id: number; begin: string; end: string };
        orders_amount: number;
        returns_amount: number;
        commission_amount: number;
        services_amount: number;
        item_delivery_and_return_amount: number;
        currency_code: string;
      }>;
    };
  }>('/v1/finance/cash-flow-statement/list', {
    date: {
      from: monthAgo.toISOString().split('T')[0] + 'T00:00:00.000Z',
      to: now.toISOString().split('T')[0] + 'T23:59:59.999Z',
    },
    page: 1,
    page_size: 1000,
    with_details: false,
  });

  const cashFlows = result.result?.cash_flows || [];
  // Чистый денежный поток за период = начисления + возвраты − комиссии − услуги − логистика
  const netFlow = cashFlows.reduce(
    (sum, f) =>
      sum +
      (f.orders_amount || 0) +
      (f.returns_amount || 0) +
      (f.commission_amount || 0) +
      (f.services_amount || 0) +
      (f.item_delivery_and_return_amount || 0),
    0
  );

  const balanceData: BalanceData = {
    balance: Math.round(netFlow * 100) / 100,
    currency: cashFlows[cashFlows.length - 1]?.currency_code || 'RUB',
    updatedAt: new Date().toISOString(),
  };

  await logRead('ozon_get_balance', 'finance', {}, { balance: balanceData.balance });

  return { balance: balanceData };
}

/**
 * Получить список транзакций
 * POST /v3/finance/transaction/list
 */
export async function getTransactions(input: GetTransactionsInput): Promise<{
  transactions: TransactionData[];
  summary: TransactionsSummary;
}> {
  const { dateFrom, dateTo, transactionType, page, pageSize } = input;

  // Нормализация дат
  const from = dateFrom.includes('T') ? dateFrom : `${dateFrom}T00:00:00.000Z`;
  const to = dateTo
    ? (dateTo.includes('T') ? dateTo : `${dateTo}T23:59:59.999Z`)
    : new Date().toISOString();

  // Ozon допускает период не более 1 месяца
  const spanDays = (new Date(to).getTime() - new Date(from).getTime()) / (24 * 60 * 60 * 1000);
  if (spanDays > 31) {
    throw new Error(
      `Ozon разрешает период транзакций не более 1 месяца (запрошено ~${Math.round(spanDays)} дн.). ` +
      'Сократите диапазон dateFrom..dateTo.'
    );
  }

  // Маппинг типов транзакций
  const typeMapping: Record<string, string | undefined> = {
    all: undefined,
    orders: 'orders',
    returns: 'returns',
    services: 'services',
    deposit: 'deposit',
    other: 'other',
  };

  const body: Record<string, unknown> = {
    filter: {
      date: {
        from,
        to,
      },
      transaction_type: typeMapping[transactionType || 'all'],
    },
    page: page && page > 0 ? page : 1, // Ozon требует page > 0
    page_size: Math.min(pageSize || 100, 1000),
  };

  if (!typeMapping[transactionType || 'all']) {
    delete (body.filter as Record<string, unknown>).transaction_type;
  }

  const result = await fetchOzon<{
    result: {
      operations: Array<{
        operation_id: number;
        operation_type: string;
        operation_type_name: string;
        operation_date: string;
        posting: {
          posting_number: string;
        };
        accruals_for_sale: number;
        sale_commission: number;
        amount: number;
        type: string;
        items: Array<{
          name: string;
          sku: number;
        }>;
        services: Array<{
          name: string;
          price: number;
        }>;
      }>;
      page_count: number;
      row_count: number;
    };
  }>('/v3/finance/transaction/list', body);

  const operations = result.result?.operations || [];

  const transactions: TransactionData[] = operations.map((op) => ({
    operationId: op.operation_id,
    operationType: op.operation_type || op.type,
    operationTypeName: op.operation_type_name || op.type,
    operationDate: op.operation_date,
    postingNumber: op.posting?.posting_number || '',
    accrualAmount: op.accruals_for_sale || op.amount || 0,
    saleAmount: op.sale_commission || 0,
    items: op.items || [],
    services: op.services || [],
  }));

  // Рассчитываем сводку
  const byType: Record<string, { count: number; sum: number }> = {};
  for (const t of transactions) {
    const type = t.operationTypeName || t.operationType || 'Другое';
    if (!byType[type]) {
      byType[type] = { count: 0, sum: 0 };
    }
    byType[type].count++;
    byType[type].sum += t.accrualAmount;
  }

  const summary: TransactionsSummary = {
    totalRecords: result.result?.row_count || transactions.length,
    totalAccrual: transactions.reduce((sum, t) => sum + t.accrualAmount, 0),
    totalSale: transactions.reduce((sum, t) => sum + t.saleAmount, 0),
    periodFrom: from,
    periodTo: to,
    byType,
  };

  await logRead('ozon_get_transactions', 'finance', input, {
    count: transactions.length,
    totalAccrual: summary.totalAccrual,
  });

  return { transactions, summary };
}

// ==================== Formatters ====================

/**
 * Форматировать баланс как Markdown
 */
export function formatBalanceAsMarkdown(balance: BalanceData): string {
  const lines: string[] = [
    '## Баланс Ozon',
    '',
    `| Показатель | Значение |`,
    `|------------|----------|`,
    `| Баланс | ${balance.balance.toLocaleString('ru-RU')} ${balance.currency} |`,
    `| Обновлено | ${new Date(balance.updatedAt).toLocaleString('ru-RU')} |`,
    '',
    '> Для детальной информации о транзакциях используйте `ozon_get_transactions`',
  ];

  return lines.join('\n');
}

/**
 * Форматировать транзакции как Markdown
 */
export function formatTransactionsAsMarkdown(
  transactions: TransactionData[],
  summary: TransactionsSummary
): string {
  const lines: string[] = [
    '## Транзакции Ozon',
    '',
    `**Период:** ${new Date(summary.periodFrom).toLocaleDateString('ru-RU')} — ${new Date(summary.periodTo).toLocaleDateString('ru-RU')}`,
    '',
    '### Сводка',
    '',
    `| Показатель | Значение |`,
    `|------------|----------|`,
    `| Всего записей | ${summary.totalRecords} |`,
    `| Начислено | ${summary.totalAccrual.toLocaleString('ru-RU')} ₽ |`,
    `| Комиссия | ${Math.abs(summary.totalSale).toLocaleString('ru-RU')} ₽ |`,
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

  // Список транзакций
  if (transactions.length > 0) {
    lines.push('### Последние операции');
    lines.push('');
    lines.push('| Дата | Тип | Сумма | Номер отправления |');
    lines.push('|------|-----|-------|-------------------|');

    for (const t of transactions.slice(0, 30)) {
      const date = new Date(t.operationDate).toLocaleDateString('ru-RU');
      const type = t.operationTypeName.length > 25
        ? t.operationTypeName.substring(0, 22) + '...'
        : t.operationTypeName;
      const amount = t.accrualAmount.toLocaleString('ru-RU');
      const posting = t.postingNumber || '-';

      lines.push(`| ${date} | ${type} | ${amount} ₽ | ${posting} |`);
    }

    if (transactions.length > 30) {
      lines.push('');
      lines.push(`> Показано 30 из ${transactions.length} операций`);
    }
  }

  return lines.join('\n');
}
