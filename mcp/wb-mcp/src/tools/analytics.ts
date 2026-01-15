import { z } from 'zod';
import { createWBHeaders, WB_API_URLS } from '../utils/auth.js';
import { logRead } from '../utils/logger.js';
import {
  funnelChart,
  conversionStatus,
  formatNumber,
  formatRub,
  formatPercent,
  FunnelStage,
} from '../utils/visualize.js';

// Input schema for wb_get_sales_funnel
export const GetSalesFunnelInputSchema = z.object({
  nmIds: z.array(z.number()).optional().describe('Filter by specific nmIds (max 20)'),
  dateFrom: z.string().describe('Start date in YYYY-MM-DD format'),
  dateTo: z.string().describe('End date in YYYY-MM-DD format'),
});

export type GetSalesFunnelInput = z.infer<typeof GetSalesFunnelInputSchema>;

// Input schema for wb_get_seller_info
export const GetSellerInfoInputSchema = z.object({});

export type GetSellerInfoInput = z.infer<typeof GetSellerInfoInputSchema>;

// Sales funnel data interface
interface SalesFunnelData {
  nmId: number;
  vendorCode?: string;
  brandName?: string;
  objectName?: string;
  openCardCount: number;      // Переходы в карточку
  addToCartCount: number;     // Добавления в корзину
  ordersCount: number;        // Заказы
  ordersSumRub: number;       // Сумма заказов
  buyoutsCount: number;       // Выкупы
  buyoutsSumRub: number;      // Сумма выкупов
  cancelCount: number;        // Отмены
  cancelSumRub: number;       // Сумма отмен
  // Рассчитанные метрики
  conversions: {
    cardToCart: number;       // % переходов в корзину
    cartToOrder: number;      // % заказов из корзины
    orderToBuyout: number;    // % выкупов
  };
}

// Seller info interface
interface SellerInfo {
  name: string;
  sid: string;
  tradeMark?: string;
}

// Fetch helper with error handling
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
    // Проверяем на ошибку подписки Джем
    if (response.status === 403 && text.includes('Jam')) {
      throw new Error(
        'Для доступа к аналитике требуется подписка "Джем". ' +
        'Подключите подписку в личном кабинете WB: https://seller.wildberries.ru/monetization/jam'
      );
    }
    throw new Error(`WB API Error ${response.status}: ${text}`);
  }

  if (response.status === 204) {
    return {} as T;
  }

  return response.json() as Promise<T>;
}

/**
 * Get seller info from Common API
 * Endpoint: GET https://common-api.wildberries.ru/api/v1/seller-info
 */
export async function getSellerInfo(_input: GetSellerInfoInput): Promise<SellerInfo> {
  const url = `${WB_API_URLS.common}/api/v1/seller-info`;

  const result = await fetchWB<{
    name: string;
    sid: string;
    tradeMark?: string;
  }>(url);

  await logRead('wb_get_seller_info', 'seller', {}, { success: true });

  return result;
}

/**
 * Get sales funnel data from Analytics API
 * Endpoint: GET https://seller-analytics-api.wildberries.ru/api/v2/nm-report/detail
 *
 * ВАЖНО: Требует подписку "Джем"
 */
export async function getSalesFunnel(input: GetSalesFunnelInput): Promise<{
  products: SalesFunnelData[];
  total: number;
  summary: {
    totalViews: number;
    totalCarts: number;
    totalOrders: number;
    totalOrdersSum: number;
    totalBuyouts: number;
    totalBuyoutsSum: number;
    avgConversion: number;
    avgBuyoutRate: number;
  };
}> {
  const { nmIds, dateFrom, dateTo } = input;

  // Согласно документации WB API - endpoint для отчёта по nm
  const url = `${WB_API_URLS.analytics}/api/v2/nm-report/detail`;

  const body: Record<string, unknown> = {
    period: {
      begin: `${dateFrom} 00:00:00`,
      end: `${dateTo} 23:59:59`,
    },
    page: 1,
  };

  if (nmIds && nmIds.length > 0) {
    body.nmIDs = nmIds.slice(0, 20); // Max 20 nmIds per request
  }

  const result = await fetchWB<{
    data?: {
      cards?: Array<{
        nmID: number;
        vendorCode?: string;
        brandName?: string;
        object?: { name?: string };
        statistics?: {
          selectedPeriod?: {
            openCardCount?: number;
            addToCartCount?: number;
            ordersCount?: number;
            ordersSumRub?: number;
            buyoutsCount?: number;
            buyoutsSumRub?: number;
            cancelCount?: number;
            cancelSumRub?: number;
          };
        };
      }>;
      isNextPage?: boolean;
    };
    error?: boolean;
    errorText?: string;
  }>(url, {
    method: 'POST',
    body: JSON.stringify(body),
  });

  if (result.error) {
    throw new Error(result.errorText || 'Analytics API error');
  }

  const cards = result.data?.cards || [];

  const products: SalesFunnelData[] = cards.map((card) => {
    const stats = card.statistics?.selectedPeriod || {};
    const openCard = stats.openCardCount || 0;
    const addToCart = stats.addToCartCount || 0;
    const orders = stats.ordersCount || 0;
    const buyouts = stats.buyoutsCount || 0;

    return {
      nmId: card.nmID,
      vendorCode: card.vendorCode,
      brandName: card.brandName,
      objectName: card.object?.name,
      openCardCount: openCard,
      addToCartCount: addToCart,
      ordersCount: orders,
      ordersSumRub: stats.ordersSumRub || 0,
      buyoutsCount: buyouts,
      buyoutsSumRub: stats.buyoutsSumRub || 0,
      cancelCount: stats.cancelCount || 0,
      cancelSumRub: stats.cancelSumRub || 0,
      conversions: {
        cardToCart: openCard > 0 ? (addToCart / openCard) * 100 : 0,
        cartToOrder: addToCart > 0 ? (orders / addToCart) * 100 : 0,
        orderToBuyout: orders > 0 ? (buyouts / orders) * 100 : 0,
      },
    };
  });

  // Calculate summary
  const totalViews = products.reduce((sum, p) => sum + p.openCardCount, 0);
  const totalCarts = products.reduce((sum, p) => sum + p.addToCartCount, 0);
  const totalOrders = products.reduce((sum, p) => sum + p.ordersCount, 0);
  const totalOrdersSum = products.reduce((sum, p) => sum + p.ordersSumRub, 0);
  const totalBuyouts = products.reduce((sum, p) => sum + p.buyoutsCount, 0);
  const totalBuyoutsSum = products.reduce((sum, p) => sum + p.buyoutsSumRub, 0);

  const avgConversion = totalViews > 0 ? (totalOrders / totalViews) * 100 : 0;
  const avgBuyoutRate = totalOrders > 0 ? (totalBuyouts / totalOrders) * 100 : 0;

  await logRead('wb_get_sales_funnel', 'analytics', input, {
    count: products.length,
    totalViews,
    totalOrders,
    totalBuyouts,
  });

  return {
    products,
    total: products.length,
    summary: {
      totalViews,
      totalCarts,
      totalOrders,
      totalOrdersSum,
      totalBuyouts,
      totalBuyoutsSum,
      avgConversion: Math.round(avgConversion * 100) / 100,
      avgBuyoutRate: Math.round(avgBuyoutRate * 100) / 100,
    },
  };
}

/**
 * Format seller info as markdown
 */
export function formatSellerInfoAsMarkdown(info: SellerInfo): string {
  return [
    '## Информация о продавце',
    '',
    `**Название:** ${info.name}`,
    `**ID продавца:** ${info.sid}`,
    info.tradeMark ? `**Торговая марка:** ${info.tradeMark}` : '',
  ]
    .filter(Boolean)
    .join('\n');
}

/**
 * Format sales funnel as markdown with visual charts
 */
export function formatSalesFunnelAsMarkdown(
  products: SalesFunnelData[],
  summary: {
    totalViews: number;
    totalCarts: number;
    totalOrders: number;
    totalOrdersSum: number;
    totalBuyouts: number;
    totalBuyoutsSum: number;
    avgConversion: number;
    avgBuyoutRate: number;
  }
): string {
  const lines: string[] = [];

  // Funnel visualization
  lines.push('## Воронка продаж\n');

  const stages: FunnelStage[] = [
    { name: 'Просмотры', value: summary.totalViews },
    { name: 'Корзина', value: summary.totalCarts },
    { name: 'Заказы', value: summary.totalOrders },
    { name: 'Выкупы', value: summary.totalBuyouts },
  ];

  lines.push('```');
  lines.push(funnelChart(stages, 25));
  lines.push('```');
  lines.push('');

  // Conversion analysis
  lines.push('## Конверсии\n');

  const viewToCart = summary.totalViews > 0 ? (summary.totalCarts / summary.totalViews) * 100 : 0;
  const cartToOrder = summary.totalCarts > 0 ? (summary.totalOrders / summary.totalCarts) * 100 : 0;
  const orderToBuyout = summary.totalOrders > 0 ? (summary.totalBuyouts / summary.totalOrders) * 100 : 0;

  lines.push(`- Просмотр → Корзина: ${conversionStatus(viewToCart, 3, 7)}`);
  lines.push(`- Корзина → Заказ: ${conversionStatus(cartToOrder, 50, 70)}`);
  lines.push(`- Заказ → Выкуп: ${conversionStatus(orderToBuyout, 70, 85)}`);
  lines.push('');

  // Financial summary
  lines.push('## Финансы\n');
  lines.push(`- **Сумма заказов:** ${formatRub(summary.totalOrdersSum)}`);
  lines.push(`- **Сумма выкупов:** ${formatRub(summary.totalBuyoutsSum)}`);
  if (summary.totalOrdersSum > 0) {
    const lostRevenue = summary.totalOrdersSum - summary.totalBuyoutsSum;
    const lostPercent = (lostRevenue / summary.totalOrdersSum) * 100;
    lines.push(`- **Потери (отмены/возвраты):** ${formatRub(lostRevenue)} (${formatPercent(lostPercent)})`);
  }
  lines.push('');

  // Product table
  lines.push('## По товарам\n');
  lines.push('| nmId | Просмотры | Корзина | Заказы | Выкупы | CR | Выкуп |');
  lines.push('|------|-----------|---------|--------|--------|-----|-------|');

  for (const p of products.slice(0, 30)) {
    const cr = formatPercent(p.conversions.cardToCart);
    const buyoutRate = formatPercent(p.conversions.orderToBuyout);
    lines.push(
      `| ${p.nmId} | ${formatNumber(p.openCardCount)} | ${formatNumber(p.addToCartCount)} | ${formatNumber(p.ordersCount)} | ${formatNumber(p.buyoutsCount)} | ${cr} | ${buyoutRate} |`
    );
  }

  if (products.length > 30) {
    lines.push(`\n*... и ещё ${products.length - 30} товаров*`);
  }

  lines.push(`\n**Всего товаров:** ${products.length}`);

  return lines.join('\n');
}
