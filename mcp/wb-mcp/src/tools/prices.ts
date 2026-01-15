import { z } from 'zod';
import { createWBHeaders, WB_API_URLS } from '../utils/auth.js';
import { logPriceChange, getCachedProduct, cacheProduct } from '../db/postgres.js';
import { logRead, logWriteWithPreview, logWriteConfirmed, logError } from '../utils/logger.js';
import {
  createPriceChangePreview,
  formatPreviewForDisplay,
  needsConfirmation,
  confirmed,
  type WriteOperationResult,
} from '../utils/confirmation.js';

// Input schema for wb_get_prices
export const GetPricesInputSchema = z.object({
  nmIds: z.array(z.number()).optional().describe('Filter by specific nmIds'),
  limit: z.number().optional().default(100).describe('Maximum number of products to return'),
  offset: z.number().optional().default(0).describe('Offset for pagination'),
});

export type GetPricesInput = z.infer<typeof GetPricesInputSchema>;

// Input schema for wb_update_price
export const UpdatePriceInputSchema = z.object({
  nmId: z.number().describe('Product nmId'),
  price: z.number().optional().describe('New price (before discount)'),
  discount: z.number().optional().describe('New discount percentage (0-100)'),
  confirm: z.boolean().optional().default(false).describe('Set to true to confirm and apply changes'),
});

export type UpdatePriceInput = z.infer<typeof UpdatePriceInputSchema>;

// Price data interface
interface PriceData {
  nmId: number;
  vendorCode?: string;
  price: number;
  discount: number;
  promoCode: number;
  finalPrice: number;
  sizes?: Array<{
    sizeID: number;
    price: number;
    discountedPrice: number;
    techSizeName?: string;
  }>;
}

// Fetch helper
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

/**
 * Get prices from WB API
 */
export async function getPrices(input: GetPricesInput): Promise<{
  products: PriceData[];
  total: number;
}> {
  const { nmIds, limit, offset } = input;
  const products: PriceData[] = [];
  let currentOffset = offset;

  while (products.length < limit) {
    const url = `${WB_API_URLS.prices}/api/v2/list/goods/filter?limit=${Math.min(1000, limit)}&offset=${currentOffset}`;

    const result = await fetchWB<{
      data?: {
        listGoods?: Array<{
          nmID: number;
          vendorCode?: string;
          sizes: Array<{
            sizeID: number;
            price: number;
            discountedPrice: number;
            techSizeName?: string;
          }>;
          discount?: number;
          promoCode?: number;
        }>;
      };
    }>(url);

    const goods = result.data?.listGoods || [];
    if (goods.length === 0) break;

    for (const item of goods) {
      // Filter by nmIds if specified
      if (nmIds && nmIds.length > 0 && !nmIds.includes(item.nmID)) {
        continue;
      }

      const size = item.sizes?.[0];
      if (size) {
        const discount = item.discount || 0;
        products.push({
          nmId: item.nmID,
          vendorCode: item.vendorCode,
          price: size.price,
          discount,
          promoCode: item.promoCode || 0,
          finalPrice: Math.round(size.price * (1 - discount / 100)),
          sizes: item.sizes,
        });
      }

      if (products.length >= limit) break;
    }

    if (goods.length < 1000) break;
    currentOffset += goods.length;
  }

  await logRead('wb_get_prices', 'prices', input, { count: products.length });

  return {
    products,
    total: products.length,
  };
}

/**
 * Format prices as markdown table
 */
export function formatPricesAsMarkdown(products: PriceData[]): string {
  if (products.length === 0) {
    return 'Товары не найдены';
  }

  const lines = [
    '| nmId | Артикул | Цена | Скидка | Промокод | Финальная цена |',
    '|------|---------|------|--------|----------|----------------|',
  ];

  for (const p of products.slice(0, 50)) {
    lines.push(
      `| ${p.nmId} | ${p.vendorCode || '-'} | ${p.price}₽ | ${p.discount}% | ${p.promoCode}% | ${p.finalPrice}₽ |`
    );
  }

  if (products.length > 50) {
    lines.push(`\n... и ещё ${products.length - 50} товаров`);
  }

  lines.push(`\n**Всего товаров:** ${products.length}`);

  return lines.join('\n');
}

/**
 * Get current price for a product (from cache or API)
 */
async function getCurrentPrice(nmId: number): Promise<{
  price: number;
  discount: number;
  productName?: string;
} | null> {
  // Try cache first
  const cached = await getCachedProduct('wb', nmId.toString(), 60); // 1 hour cache
  if (cached && cached.price) {
    return {
      price: cached.price as number,
      discount: (cached.discount_percent as number) || 0,
      productName: cached.name as string,
    };
  }

  // Fetch from API
  const result = await getPrices({ nmIds: [nmId], limit: 1, offset: 0 });
  if (result.products.length > 0) {
    const product = result.products[0];
    return {
      price: product.price,
      discount: product.discount,
    };
  }

  return null;
}

/**
 * Update price with confirmation system
 */
export async function updatePrice(
  input: UpdatePriceInput
): Promise<WriteOperationResult<{ success: boolean; nmId: number; newPrice?: number; newDiscount?: number }>> {
  const { nmId, price, discount, confirm } = input;

  if (price === undefined && discount === undefined) {
    throw new Error('At least one of price or discount must be specified');
  }

  // Get current price
  const current = await getCurrentPrice(nmId);
  if (!current) {
    throw new Error(`Product ${nmId} not found`);
  }

  const newPrice = price ?? current.price;
  const newDiscount = discount ?? current.discount;

  // If not confirmed, return preview
  if (!confirm) {
    const preview = createPriceChangePreview({
      nmId: nmId.toString(),
      productName: current.productName,
      currentPrice: current.price,
      newPrice,
      currentDiscount: current.discount,
      newDiscount,
      toolName: 'wb_update_price',
    });

    await logWriteWithPreview('wb_update_price', 'prices', input, preview as unknown as Record<string, unknown>);

    return needsConfirmation(preview);
  }

  // Confirmed - apply changes
  try {
    // Call WB API to update price
    const url = `${WB_API_URLS.prices}/api/v2/upload/task`;

    await fetchWB<{ data: unknown; error: boolean; errorText?: string }>(url, {
      method: 'POST',
      body: JSON.stringify({
        data: [
          {
            nmID: nmId,
            price: newPrice,
            discount: newDiscount,
          },
        ],
      }),
    });

    // Log successful change
    await logPriceChange({
      marketplace: 'wb',
      nmId: nmId.toString(),
      priceOld: current.price,
      priceNew: newPrice,
      discountOld: current.discount,
      discountNew: newDiscount,
      changedBy: 'mcp',
      reason: 'Manual price update via wb_update_price',
    });

    // Update cache
    await cacheProduct({
      marketplace: 'wb',
      nmId: nmId.toString(),
      price: newPrice,
      discountPercent: newDiscount,
    });

    const preview = createPriceChangePreview({
      nmId: nmId.toString(),
      productName: current.productName,
      currentPrice: current.price,
      newPrice,
      currentDiscount: current.discount,
      newDiscount,
      toolName: 'wb_update_price',
    });

    await logWriteConfirmed('wb_update_price', 'prices', input, { success: true }, preview as unknown as Record<string, unknown>);

    return confirmed({
      success: true,
      nmId,
      newPrice,
      newDiscount,
    });
  } catch (error) {
    await logError('wb_update_price', 'prices', input, error as Error);
    throw error;
  }
}

/**
 * Format update result for display
 */
export function formatUpdateResult(
  result: WriteOperationResult<{ success: boolean; nmId: number; newPrice?: number; newDiscount?: number }>
): string {
  if (!result.confirmed) {
    return formatPreviewForDisplay(result.preview);
  }

  const { nmId, newPrice, newDiscount } = result.result;
  return [
    '## Цена успешно обновлена',
    '',
    `**nmId:** ${nmId}`,
    `**Новая цена:** ${newPrice}₽`,
    `**Новая скидка:** ${newDiscount}%`,
    `**Финальная цена:** ${Math.round(newPrice! * (1 - newDiscount! / 100))}₽`,
  ].join('\n');
}
