import { z } from 'zod';
import { createOzonHeaders, OZON_API_URL } from '../utils/auth.js';
import { logRead, logWriteWithPreview, logWriteConfirmed, logError } from '../utils/logger.js';

// Input schema for ozon_get_prices
export const GetPricesInputSchema = z.object({
  offerIds: z.array(z.string()).optional().describe('Filter by seller offer_ids (SKUs)'),
  productIds: z.array(z.number()).optional().describe('Filter by Ozon product_ids'),
  visibility: z.enum(['ALL', 'VISIBLE', 'INVISIBLE', 'EMPTY_STOCK', 'NOT_MODERATED', 'MODERATED']).optional().default('ALL'),
  limit: z.number().int().positive('limit должен быть больше 0').optional().default(100).describe('Maximum number of products to return'),
});

export type GetPricesInput = z.infer<typeof GetPricesInputSchema>;

// Input schema for ozon_update_price
export const UpdatePriceInputSchema = z.object({
  offerId: z.string().describe('Product offer_id (seller SKU)'),
  price: z.string().optional().describe('New price (string format, e.g., "1500")'),
  oldPrice: z.string().optional().describe('Old price (strikethrough price)'),
  premiumPrice: z.string().optional().describe('Price for Premium users'),
  vat: z.enum(['0', '0.1', '0.2']).optional().default('0.2').describe('VAT rate'),
  confirm: z.boolean().optional().default(false).describe('Set to true to confirm and apply changes'),
});

export type UpdatePriceInput = z.infer<typeof UpdatePriceInputSchema>;

// Price data interface (Ozon v5 /product/info/prices)
interface OzonPriceData {
  productId: number;
  offerId: string;
  price: string;                 // текущая цена
  oldPrice: string;              // зачёркнутая (старая) цена
  marketingSellerPrice: string;  // цена с учётом акций продавца = цена со скидкой
  minPrice: string;
  vat: string;
  currency: string;
  commissions?: {
    salesPercentFbo: number;
    salesPercentFbs: number;
  };
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

/**
 * Get prices from Ozon API
 * POST /v5/product/info/prices
 */
export async function getPrices(input: GetPricesInput): Promise<{
  products: OzonPriceData[];
  total: number;
}> {
  const products: OzonPriceData[] = [];
  let cursor = '';

  while (products.length < input.limit) {
    const body: Record<string, unknown> = {
      filter: {
        visibility: input.visibility || 'ALL',
      },
      limit: Math.min(100, input.limit - products.length),
      cursor: cursor || undefined,
    };

    // Add offer_id filter if specified
    if (input.offerIds && input.offerIds.length > 0) {
      (body.filter as Record<string, unknown>).offer_id = input.offerIds;
    }

    // Add product_id filter if specified
    if (input.productIds && input.productIds.length > 0) {
      (body.filter as Record<string, unknown>).product_id = input.productIds;
    }

    // Ozon v5: ответ — { items, total, cursor } (без обёртки result); цены приходят числами
    const result = await fetchOzon<{
      items: Array<{
        product_id: number;
        offer_id: string;
        price: {
          price: number;
          old_price: number;
          marketing_seller_price: number;
          min_price: number;
          vat: number;
          currency_code: string;
        };
        commissions: {
          sales_percent_fbo: number;
          sales_percent_fbs: number;
        };
      }>;
      total: number;
      cursor: string;
    }>('/v5/product/info/prices', body);

    const items = result.items || [];
    if (items.length === 0) break;

    for (const item of items) {
      products.push({
        productId: item.product_id,
        offerId: item.offer_id,
        price: String(item.price?.price ?? ''),
        oldPrice: String(item.price?.old_price ?? ''),
        marketingSellerPrice: String(item.price?.marketing_seller_price ?? ''),
        minPrice: String(item.price?.min_price ?? ''),
        vat: String(item.price?.vat ?? ''),
        currency: item.price?.currency_code || 'RUB',
        commissions: {
          salesPercentFbo: item.commissions?.sales_percent_fbo ?? 0,
          salesPercentFbs: item.commissions?.sales_percent_fbs ?? 0,
        },
      });
    }

    cursor = result.cursor;
    if (!cursor || items.length < 100) break;
  }

  await logRead('ozon_get_prices', 'prices', input, { count: products.length });

  return {
    products,
    total: products.length,
  };
}

/**
 * Format prices as markdown table
 */
export function formatPricesAsMarkdown(products: OzonPriceData[]): string {
  if (products.length === 0) {
    return 'Товары не найдены';
  }

  const lines = [
    '| Product ID | Артикул | Цена | Старая цена | Цена со скидкой | Комиссия FBS |',
    '|------------|---------|------|-------------|-----------------|--------------|',
  ];

  for (const p of products.slice(0, 50)) {
    const commission = p.commissions ? `${p.commissions.salesPercentFbs}%` : '-';
    lines.push(
      `| ${p.productId} | ${p.offerId} | ${p.price}₽ | ${p.oldPrice || '-'}₽ | ${p.marketingSellerPrice || '-'}₽ | ${commission} |`
    );
  }

  if (products.length > 50) {
    lines.push(`\n... и ещё ${products.length - 50} товаров`);
  }

  lines.push(`\n**Всего товаров:** ${products.length}`);

  return lines.join('\n');
}

/**
 * Preview type for price changes
 */
interface PriceChangePreview {
  offerId: string;
  productName?: string;
  currentPrice: string;
  newPrice: string;
  currentOldPrice?: string;
  newOldPrice?: string;
  priceChangePercent: number;
  toolName: string;
}

/**
 * Write operation result type
 */
interface WriteOperationResult<T> {
  confirmed: boolean;
  preview?: PriceChangePreview;
  result: T;
}

function needsConfirmation(preview: PriceChangePreview): WriteOperationResult<{ success: boolean; offerId: string; newPrice?: string; newOldPrice?: string }> {
  return {
    confirmed: false,
    preview,
    result: { success: false, offerId: preview.offerId },
  };
}

function confirmed<T>(result: T): WriteOperationResult<T> {
  return {
    confirmed: true,
    result,
  };
}

/**
 * Get current price for a product
 */
async function getCurrentPrice(offerId: string): Promise<{
  price: string;
  oldPrice: string;
} | null> {
  const result = await getPrices({ offerIds: [offerId], limit: 1, visibility: 'ALL' });
  if (result.products.length > 0) {
    const product = result.products[0];
    return {
      price: product.price,
      oldPrice: product.oldPrice,
    };
  }

  return null;
}

/**
 * Update price with confirmation system
 * POST /v1/product/import/prices
 */
export async function updatePrice(
  input: UpdatePriceInput
): Promise<WriteOperationResult<{ success: boolean; offerId: string; newPrice?: string; newOldPrice?: string }>> {
  const { offerId, price, oldPrice, premiumPrice, vat, confirm } = input;

  if (price === undefined && oldPrice === undefined && premiumPrice === undefined) {
    throw new Error('At least one of price, oldPrice, or premiumPrice must be specified');
  }

  // Get current price
  const current = await getCurrentPrice(offerId);
  if (!current) {
    throw new Error(`Product ${offerId} not found`);
  }

  const newPrice = price ?? current.price;
  const newOldPrice = oldPrice ?? current.oldPrice;

  // Calculate price change percent
  const currentPriceNum = parseFloat(current.price);
  const newPriceNum = parseFloat(newPrice);
  const priceChangePercent = currentPriceNum > 0
    ? ((newPriceNum - currentPriceNum) / currentPriceNum) * 100
    : 0;

  // If not confirmed, return preview
  if (!confirm) {
    const preview: PriceChangePreview = {
      offerId,
      currentPrice: current.price,
      newPrice,
      currentOldPrice: current.oldPrice,
      newOldPrice,
      priceChangePercent,
      toolName: 'ozon_update_price',
    };

    await logWriteWithPreview('ozon_update_price', 'prices', input, preview as unknown as Record<string, unknown>);

    return needsConfirmation(preview);
  }

  // Confirmed - apply changes
  try {
    // Call Ozon API to update price
    const result = await fetchOzon<{
      result: Array<{
        offer_id: string;
        product_id: number;
        updated: boolean;
        errors: Array<{ code: string; message: string }>;
      }>;
    }>('/v1/product/import/prices', {
      prices: [
        {
          offer_id: offerId,
          price: newPrice,
          old_price: newOldPrice,
          premium_price: premiumPrice || '0',
          vat: vat || '0.2',
        },
      ],
    });

    const updateResult = result.result?.[0];
    if (!updateResult?.updated) {
      const errors = updateResult?.errors?.map((e) => e.message).join(', ') || 'Unknown error';
      throw new Error(`Failed to update price: ${errors}`);
    }

    const preview: PriceChangePreview = {
      offerId,
      currentPrice: current.price,
      newPrice,
      currentOldPrice: current.oldPrice,
      newOldPrice,
      priceChangePercent,
      toolName: 'ozon_update_price',
    };

    await logWriteConfirmed('ozon_update_price', 'prices', input, { success: true }, preview as unknown as Record<string, unknown>);

    return confirmed({
      success: true,
      offerId,
      newPrice,
      newOldPrice,
    });
  } catch (error) {
    await logError('ozon_update_price', 'prices', input, error as Error);
    throw error;
  }
}

/**
 * Format update result for display
 */
export function formatUpdateResult(
  result: WriteOperationResult<{ success: boolean; offerId: string; newPrice?: string; newOldPrice?: string }>
): string {
  if (!result.confirmed && result.preview) {
    const p = result.preview;
    const changeIcon = p.priceChangePercent > 0 ? '📈' : p.priceChangePercent < 0 ? '📉' : '➡️';
    const changeText = p.priceChangePercent !== 0
      ? ` (${p.priceChangePercent > 0 ? '+' : ''}${p.priceChangePercent.toFixed(1)}%)`
      : '';

    return [
      '## Preview изменения цены',
      '',
      `**Артикул:** ${p.offerId}`,
      p.productName ? `**Товар:** ${p.productName}` : '',
      '',
      '### Изменения:',
      `| Параметр | БЫЛО | СТАНЕТ |`,
      `|----------|------|--------|`,
      `| Цена | ${p.currentPrice}₽ | ${p.newPrice}₽ ${changeIcon}${changeText} |`,
      `| Старая цена | ${p.currentOldPrice || '-'}₽ | ${p.newOldPrice || '-'}₽ |`,
      '',
      '---',
      '**Для применения изменений вызовите инструмент с `confirm: true`**',
    ].filter(Boolean).join('\n');
  }

  const { offerId, newPrice, newOldPrice } = result.result;
  return [
    '## Цена успешно обновлена',
    '',
    `**Артикул:** ${offerId}`,
    `**Новая цена:** ${newPrice}₽`,
    newOldPrice ? `**Старая цена:** ${newOldPrice}₽` : '',
  ].filter(Boolean).join('\n');
}
