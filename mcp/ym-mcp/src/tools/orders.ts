/**
 * Orders tools for Yandex Market MCP
 */

import { z } from 'zod';
import { apiRequest, getBusinessId } from '../api/client.js';

// Input schemas
export const GetOrdersInputSchema = z.object({
  businessId: z.number().optional().describe('ID кабинета (по умолчанию из env)'),
  dateFrom: z.string().optional().describe('Дата начала (YYYY-MM-DD)'),
  dateTo: z.string().optional().describe('Дата конца (YYYY-MM-DD)'),
  status: z.enum([
    'CANCELLED',
    'DELIVERED',
    'DELIVERY',
    'PICKUP',
    'PROCESSING',
    'PENDING',
    'UNPAID',
    'RESERVED',
  ]).optional().describe('Фильтр по статусу'),
  limit: z.number().min(1).max(200).default(100).optional(),
  pageToken: z.string().optional().describe('Токен для пагинации'),
}).strict();

export type GetOrdersInput = z.infer<typeof GetOrdersInputSchema>;

// Response types
interface OrderItem {
  offerId: string;
  offerName: string;
  count: number;
  price: number;
  subsidy?: number;
}

interface Order {
  id: number;
  creationDate: string;
  status: string;
  substatus?: string;
  paymentType?: string;
  paymentMethod?: string;
  buyer?: {
    type?: string;
  };
  delivery?: {
    type?: string;
    serviceName?: string;
    regionId?: number;
    address?: {
      city?: string;
      street?: string;
    };
    dates?: {
      fromDate?: string;
      toDate?: string;
    };
  };
  items: OrderItem[];
  total?: number;
  itemsTotal?: number;
  deliveryTotal?: number;
  subsidyTotal?: number;
}

interface BusinessOrder {
  orderId: number;
  campaignId?: number;
  status: string;
  substatus?: string;
  creationDate: string;
  updateDate?: string;
  paymentType?: string;
  paymentMethod?: string;
  items?: Array<{
    id?: number;
    offerId: string;
    offerName: string;
    count: number;
    prices?: {
      payment?: { value: number };
    };
  }>;
  prices?: {
    payment?: { value: number };
    delivery?: { payment?: { value: number } };
  };
  delivery?: {
    type?: string;
    courier?: {
      address?: { city?: string };
      region?: { name?: string };
    };
    pickup?: {
      address?: { city?: string };
    };
  };
}

interface OrdersResponse {
  orders?: BusinessOrder[];
  paging?: {
    nextPageToken?: string;
  };
}

// Status translations
const statusNames: Record<string, string> = {
  CANCELLED: '❌ Отменён',
  DELIVERED: '✅ Доставлен',
  DELIVERY: '🚚 Доставляется',
  PICKUP: '📦 Готов к выдаче',
  PROCESSING: '⏳ Обрабатывается',
  PENDING: '🕐 Ожидает',
  UNPAID: '💳 Не оплачен',
  RESERVED: '📋 Зарезервирован',
};

// Get orders
export async function getOrders(input: GetOrdersInput): Promise<{
  orders: Array<{
    id: number;
    createdAt: string;
    status: string;
    statusText: string;
    deliveryType: string;
    city: string;
    items: Array<{
      offerId: string;
      name: string;
      quantity: number;
      price: number;
    }>;
    total: number;
    itemsTotal: number;
    deliveryTotal: number;
  }>;
  summary: {
    total: number;
    totalRevenue: number;
    byStatus: Record<string, number>;
  };
  nextPageToken?: string;
}> {
  const businessId = input.businessId || parseInt(getBusinessId());

  // Default dates: last 30 days
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const dateFrom = input.dateFrom || thirtyDaysAgo.toISOString().split('T')[0];
  const dateTo = input.dateTo || now.toISOString().split('T')[0];

  const body: Record<string, unknown> = {
    dates: {
      creationDateFrom: dateFrom,
      creationDateTo: dateTo,
    },
  };

  if (input.status) {
    body.statuses = [input.status];
  }

  if (input.pageToken) {
    body.page_token = input.pageToken;
  }

  const response = await apiRequest<OrdersResponse>(
    `/v1/businesses/${businessId}/orders`,
    'POST',
    body
  );

  const orders = (response.orders || []).map((order) => {
    // Get city from courier or pickup delivery
    const city = order.delivery?.courier?.address?.city
      || order.delivery?.courier?.region?.name
      || order.delivery?.pickup?.address?.city
      || '';

    // Calculate total from prices
    const paymentTotal = order.prices?.payment?.value || 0;
    const deliveryTotal = order.prices?.delivery?.payment?.value || 0;

    return {
      id: order.orderId,
      createdAt: order.creationDate,
      status: order.status,
      statusText: statusNames[order.status] || order.status,
      deliveryType: order.delivery?.type || '',
      city,
      items: (order.items || []).map((item) => ({
        offerId: item.offerId,
        name: item.offerName,
        quantity: item.count,
        price: item.prices?.payment?.value || 0,
      })),
      total: paymentTotal,
      itemsTotal: paymentTotal - deliveryTotal,
      deliveryTotal,
    };
  });

  // Calculate summary
  const byStatus: Record<string, number> = {};
  let totalRevenue = 0;

  for (const order of orders) {
    byStatus[order.status] = (byStatus[order.status] || 0) + 1;
    if (order.status === 'DELIVERED') {
      totalRevenue += order.total;
    }
  }

  return {
    orders,
    summary: {
      total: orders.length,
      totalRevenue,
      byStatus,
    },
    nextPageToken: response.paging?.nextPageToken,
  };
}

// Formatters
export function formatOrdersAsMarkdown(
  orders: Array<{
    id: number;
    createdAt: string;
    status: string;
    statusText: string;
    deliveryType: string;
    city: string;
    items: Array<{
      offerId: string;
      name: string;
      quantity: number;
      price: number;
    }>;
    total: number;
    itemsTotal: number;
    deliveryTotal: number;
  }>,
  summary: {
    total: number;
    totalRevenue: number;
    byStatus: Record<string, number>;
  },
  nextPageToken?: string
): string {
  const lines: string[] = [
    '## Заказы Яндекс.Маркет',
    '',
  ];

  // Summary
  lines.push('### Сводка');
  lines.push('');
  lines.push(`- **Всего заказов:** ${summary.total}`);
  lines.push(`- **Выручка (доставлено):** ${summary.totalRevenue.toLocaleString('ru-RU')} ₽`);
  lines.push('');

  // Status breakdown
  if (Object.keys(summary.byStatus).length > 0) {
    lines.push('**По статусам:**');
    for (const [status, count] of Object.entries(summary.byStatus)) {
      const statusText = statusNames[status] || status;
      lines.push(`- ${statusText}: ${count}`);
    }
    lines.push('');
  }

  if (!orders.length) {
    lines.push('Заказы не найдены.');
    return lines.join('\n');
  }

  // Orders table
  lines.push('### Список заказов');
  lines.push('');
  lines.push('| № | Дата | Статус | Город | Сумма |');
  lines.push('|---|------|--------|-------|-------|');

  for (const order of orders.slice(0, 50)) {
    const date = new Date(order.createdAt).toLocaleDateString('ru-RU');
    const total = `${order.total.toLocaleString('ru-RU')} ₽`;

    lines.push(
      `| ${order.id} | ${date} | ${order.statusText} | ${order.city || '-'} | ${total} |`
    );
  }

  if (orders.length > 50) {
    lines.push('');
    lines.push(`> Показаны первые 50 из ${orders.length} заказов`);
  }

  if (nextPageToken) {
    lines.push('');
    lines.push(`> Есть ещё заказы. Используйте pageToken: \`${nextPageToken}\``);
  }

  return lines.join('\n');
}
