import { z } from 'zod';
import { createOzonHeaders, OZON_API_URL } from '../utils/auth.js';
import { logRead } from '../utils/logger.js';

// Input schema for ozon_get_orders
export const GetOrdersInputSchema = z.object({
  dateFrom: z.string().optional().describe('Start date (YYYY-MM-DD), defaults to 30 days ago'),
  dateTo: z.string().optional().describe('End date (YYYY-MM-DD), defaults to today'),
  status: z.enum([
    'awaiting_approve',
    'awaiting_packaging',
    'awaiting_deliver',
    'delivering',
    'delivered',
    'cancelled',
    'all'
  ]).optional().default('all').describe('Order status filter'),
  limit: z.number().optional().default(100).describe('Maximum number of orders to return'),
});

export type GetOrdersInput = z.infer<typeof GetOrdersInputSchema>;

// Order item interface
interface OrderItem {
  sku: number;
  offerId: string;
  name: string;
  quantity: number;
  price: string;
  currencyCode: string;
}

// Order interface
interface OzonOrder {
  postingNumber: string;
  orderId: number;
  orderNumber: string;
  status: string;
  createdAt: string;
  shipmentDate: string;
  deliveryMethod: string;
  warehouseName: string;
  region: string;
  city: string;
  totalPrice: number;
  items: OrderItem[];
  isFbo: boolean;
}

// Fetch helper
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

// Status mapping for API
const STATUS_MAP: Record<string, string[]> = {
  'awaiting_approve': ['awaiting_approve'],
  'awaiting_packaging': ['awaiting_packaging'],
  'awaiting_deliver': ['awaiting_deliver'],
  'delivering': ['delivering'],
  'delivered': ['delivered'],
  'cancelled': ['cancelled'],
  'all': [],
};

/**
 * Get FBS orders from Ozon API
 * POST /v3/posting/fbs/list
 */
async function getFbsOrders(
  dateFrom: string,
  dateTo: string,
  status: string,
  limit: number
): Promise<OzonOrder[]> {
  const orders: OzonOrder[] = [];
  let offset = 0;

  while (orders.length < limit) {
    const body: Record<string, unknown> = {
      dir: 'DESC',
      filter: {
        since: new Date(dateFrom).toISOString(),
        to: new Date(dateTo + 'T23:59:59').toISOString(),
      },
      limit: Math.min(50, limit - orders.length),
      offset,
      with: {
        analytics_data: true,
        financial_data: true,
      },
    };

    // Add status filter if not 'all'
    if (status !== 'all' && STATUS_MAP[status]) {
      (body.filter as Record<string, unknown>).status = STATUS_MAP[status][0];
    }

    const result = await fetchOzon<{
      result: {
        postings: Array<{
          posting_number: string;
          order_id: number;
          order_number: string;
          status: string;
          in_process_at: string;
          shipment_date: string;
          delivering_date?: string;
          delivery_method: {
            name: string;
            warehouse: string;
            warehouse_id: number;
          };
          analytics_data?: {
            region: string;
            city: string;
          };
          financial_data?: {
            products: Array<{
              price: number;
              quantity: number;
            }>;
          };
          products: Array<{
            sku: number;
            offer_id: string;
            name: string;
            quantity: number;
            price: string;
            currency_code: string;
          }>;
        }>;
      };
    }>('/v3/posting/fbs/list', body);

    const postings = result.result?.postings || [];
    if (postings.length === 0) break;

    for (const p of postings) {
      const totalPrice = p.products.reduce(
        (sum, item) => sum + parseFloat(item.price) * item.quantity,
        0
      );

      orders.push({
        postingNumber: p.posting_number,
        orderId: p.order_id,
        orderNumber: p.order_number,
        status: p.status,
        createdAt: p.in_process_at,
        shipmentDate: p.shipment_date,
        deliveryMethod: p.delivery_method?.name || 'FBS',
        warehouseName: p.delivery_method?.warehouse || '',
        region: p.analytics_data?.region || '',
        city: p.analytics_data?.city || '',
        totalPrice,
        items: p.products.map((item) => ({
          sku: item.sku,
          offerId: item.offer_id,
          name: item.name,
          quantity: item.quantity,
          price: item.price,
          currencyCode: item.currency_code,
        })),
        isFbo: false,
      });
    }

    if (postings.length < 50) break;
    offset += postings.length;
  }

  return orders;
}

/**
 * Get FBO orders from Ozon API
 * POST /v2/posting/fbo/list
 */
async function getFboOrders(
  dateFrom: string,
  dateTo: string,
  status: string,
  limit: number
): Promise<OzonOrder[]> {
  const orders: OzonOrder[] = [];
  let offset = 0;

  while (orders.length < limit) {
    const body: Record<string, unknown> = {
      dir: 'DESC',
      filter: {
        since: new Date(dateFrom).toISOString(),
        to: new Date(dateTo + 'T23:59:59').toISOString(),
      },
      limit: Math.min(50, limit - orders.length),
      offset,
      with: {
        analytics_data: true,
        financial_data: true,
      },
    };

    // Add status filter if not 'all'
    if (status !== 'all' && STATUS_MAP[status]) {
      (body.filter as Record<string, unknown>).status = STATUS_MAP[status][0];
    }

    const result = await fetchOzon<{
      result: Array<{
        posting_number: string;
        order_id: number;
        order_number: string;
        status: string;
        in_process_at: string;
        analytics_data?: {
          region: string;
          city: string;
          warehouse_name: string;
        };
        products: Array<{
          sku: number;
          offer_id: string;
          name: string;
          quantity: number;
          price: string;
          currency_code: string;
        }>;
      }>;
    }>('/v2/posting/fbo/list', body);

    const postings = result.result || [];
    if (postings.length === 0) break;

    for (const p of postings) {
      const totalPrice = p.products.reduce(
        (sum, item) => sum + parseFloat(item.price) * item.quantity,
        0
      );

      orders.push({
        postingNumber: p.posting_number,
        orderId: p.order_id,
        orderNumber: p.order_number,
        status: p.status,
        createdAt: p.in_process_at,
        shipmentDate: '',
        deliveryMethod: 'FBO',
        warehouseName: p.analytics_data?.warehouse_name || '',
        region: p.analytics_data?.region || '',
        city: p.analytics_data?.city || '',
        totalPrice,
        items: p.products.map((item) => ({
          sku: item.sku,
          offerId: item.offer_id,
          name: item.name,
          quantity: item.quantity,
          price: item.price,
          currencyCode: item.currency_code,
        })),
        isFbo: true,
      });
    }

    if (postings.length < 50) break;
    offset += postings.length;
  }

  return orders;
}

/**
 * Main handler: Get orders from Ozon (FBS + FBO)
 */
export async function getOrders(input: GetOrdersInput): Promise<{
  orders: OzonOrder[];
  total: number;
  summary: {
    totalOrders: number;
    fboOrders: number;
    fbsOrders: number;
    totalRevenue: number;
    avgOrderValue: number;
    cancelledOrders: number;
  };
}> {
  // Default dates: last 30 days
  const today = new Date();
  const thirtyDaysAgo = new Date(today);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const dateFrom = input.dateFrom || thirtyDaysAgo.toISOString().split('T')[0];
  const dateTo = input.dateTo || today.toISOString().split('T')[0];
  const status = input.status || 'all';
  const limit = input.limit || 100;

  // Fetch FBS and FBO orders in parallel
  const [fbsOrders, fboOrders] = await Promise.all([
    getFbsOrders(dateFrom, dateTo, status, limit),
    getFboOrders(dateFrom, dateTo, status, limit),
  ]);

  // Combine and sort by date
  const allOrders = [...fbsOrders, ...fboOrders]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, limit);

  // Calculate summary
  const totalRevenue = allOrders
    .filter((o) => o.status !== 'cancelled')
    .reduce((sum, o) => sum + o.totalPrice, 0);

  const cancelledOrders = allOrders.filter((o) => o.status === 'cancelled').length;
  const activeOrders = allOrders.length - cancelledOrders;

  await logRead('ozon_get_orders', 'orders', input, {
    total: allOrders.length,
    fbo: fboOrders.length,
    fbs: fbsOrders.length,
  });

  return {
    orders: allOrders,
    total: allOrders.length,
    summary: {
      totalOrders: allOrders.length,
      fboOrders: fboOrders.length,
      fbsOrders: fbsOrders.length,
      totalRevenue: Math.round(totalRevenue),
      avgOrderValue: activeOrders > 0 ? Math.round(totalRevenue / activeOrders) : 0,
      cancelledOrders,
    },
  };
}

/**
 * Format orders as markdown
 */
export function formatOrdersAsMarkdown(
  orders: OzonOrder[],
  summary: {
    totalOrders: number;
    fboOrders: number;
    fbsOrders: number;
    totalRevenue: number;
    avgOrderValue: number;
    cancelledOrders: number;
  }
): string {
  if (orders.length === 0) {
    return '📦 Заказов не найдено за указанный период';
  }

  const lines = [
    '## 📦 Заказы Ozon',
    '',
    '### Сводка',
    `| Показатель | Значение |`,
    `|------------|----------|`,
    `| Всего заказов | ${summary.totalOrders} |`,
    `| FBO | ${summary.fboOrders} |`,
    `| FBS | ${summary.fbsOrders} |`,
    `| Отменённых | ${summary.cancelledOrders} |`,
    `| **Выручка** | **${summary.totalRevenue.toLocaleString('ru-RU')} ₽** |`,
    `| Средний чек | ${summary.avgOrderValue.toLocaleString('ru-RU')} ₽ |`,
    '',
    '### Последние заказы',
    '',
    '| Дата | Номер | Тип | Статус | Город | Сумма |',
    '|------|-------|-----|--------|-------|-------|',
  ];

  // Status emoji mapping
  const statusEmoji: Record<string, string> = {
    'awaiting_approve': '🟡',
    'awaiting_packaging': '📦',
    'awaiting_deliver': '🚚',
    'delivering': '🚛',
    'delivered': '✅',
    'cancelled': '❌',
  };

  for (const order of orders.slice(0, 30)) {
    const date = new Date(order.createdAt).toLocaleDateString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
    });
    const emoji = statusEmoji[order.status] || '⚪';
    const type = order.isFbo ? 'FBO' : 'FBS';
    const city = order.city || order.region || '—';

    lines.push(
      `| ${date} | ${order.postingNumber.slice(-8)} | ${type} | ${emoji} ${order.status} | ${city.slice(0, 15)} | ${order.totalPrice.toLocaleString('ru-RU')} ₽ |`
    );
  }

  if (orders.length > 30) {
    lines.push(`\n... и ещё ${orders.length - 30} заказов`);
  }

  return lines.join('\n');
}
