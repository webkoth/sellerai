import { z } from 'zod';
import { createOzonHeaders, OZON_API_URL } from '../utils/auth.js';
import { logRead, logWriteWithPreview, logWriteConfirmed, logError } from '../utils/logger.js';

// Input schema for ozon_get_stocks
export const GetStocksInputSchema = z.object({
  offerIds: z.array(z.string()).optional().describe('Filter by seller offer_ids (SKUs)'),
  productIds: z.array(z.number()).optional().describe('Filter by Ozon product_ids'),
  visibility: z.enum(['ALL', 'VISIBLE', 'INVISIBLE', 'EMPTY_STOCK', 'NOT_MODERATED', 'MODERATED']).optional().default('ALL'),
  limit: z.number().int().positive('limit должен быть больше 0').optional().default(100).describe('Maximum number of products to return'),
});

export type GetStocksInput = z.infer<typeof GetStocksInputSchema>;

// Input schema for ozon_update_stocks
export const UpdateStocksInputSchema = z.object({
  stocks: z.array(z.object({
    offerId: z.string().describe('Product offer_id (seller SKU)'),
    warehouseId: z.number().describe('Warehouse ID'),
    stock: z.number().describe('New stock quantity'),
  })).describe('Array of stock updates'),
  confirm: z.boolean().optional().default(false).describe('Set to true to confirm and apply changes'),
});

export type UpdateStocksInput = z.infer<typeof UpdateStocksInputSchema>;

// Stock data interface
interface OzonStockData {
  productId: number;
  offerId: string;
  stocks: Array<{
    type: string; // fbo | fbs | rfbs | ...
    present: number;
    reserved: number;
  }>;
  totalFbo: number;
  totalFbs: number;
}

// Warehouse stock interface
interface WarehouseStock {
  fbsSku: number;
  offerId: string;
  productId: number;
  warehouseId: number;
  warehouseName: string;
  present: number;
  reserved: number;
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
 * Get stocks from Ozon API
 * POST /v4/product/info/stocks
 */
export async function getStocks(input: GetStocksInput): Promise<{
  products: OzonStockData[];
  total: number;
}> {
  const products: OzonStockData[] = [];
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

    // Ozon v4: ответ — { items, total, cursor } (без обёртки result), пагинация через cursor
    const result = await fetchOzon<{
      items: Array<{
        product_id: number;
        offer_id: string;
        stocks: Array<{
          type: string; // fbo | fbs | rfbs
          present: number;
          reserved: number;
        }>;
      }>;
      total: number;
      cursor: string;
    }>('/v4/product/info/stocks', body);

    const items = result.items || [];
    if (items.length === 0) break;

    for (const item of items) {
      const fboStock = item.stocks.find((s) => s.type === 'fbo');
      const fbsStock = item.stocks.find((s) => s.type === 'fbs');
      const rfbsStock = item.stocks.find((s) => s.type === 'rfbs');

      products.push({
        productId: item.product_id,
        offerId: item.offer_id,
        stocks: item.stocks,
        totalFbo: fboStock?.present || 0,
        // FBS-остаток = склады продавца: fbs + rfbs (realFBS)
        totalFbs: (fbsStock?.present || 0) + (rfbsStock?.present || 0),
      });
    }

    cursor = result.cursor;
    if (!cursor || items.length < 100) break;
  }

  await logRead('ozon_get_stocks', 'stocks', input, { count: products.length });

  return {
    products,
    total: products.length,
  };
}

/**
 * Get FBS stocks by warehouse
 * POST /v1/product/info/stocks-by-warehouse/fbs
 */
export async function getStocksByWarehouse(fbsSkus: number[]): Promise<WarehouseStock[]> {
  const result = await fetchOzon<{
    result: Array<{
      fbs_sku: number;
      offer_id: string;
      product_id: number;
      warehouse_id: number;
      warehouse_name: string;
      present: number;
      reserved: number;
    }>;
  }>('/v1/product/info/stocks-by-warehouse/fbs', {
    fbs_sku: fbsSkus,
  });

  return (result.result || []).map((item) => ({
    fbsSku: item.fbs_sku,
    offerId: item.offer_id,
    productId: item.product_id,
    warehouseId: item.warehouse_id,
    warehouseName: item.warehouse_name,
    present: item.present,
    reserved: item.reserved,
  }));
}

/**
 * Format stocks as markdown table
 */
export function formatStocksAsMarkdown(products: OzonStockData[]): string {
  if (products.length === 0) {
    return 'Товары не найдены';
  }

  const lines = [
    '| Product ID | Артикул | FBO доступно | FBO резерв | FBS доступно | FBS резерв | Всего |',
    '|------------|---------|--------------|------------|--------------|------------|-------|',
  ];

  for (const p of products.slice(0, 50)) {
    const fboStock = p.stocks.find((s) => s.type === 'fbo');
    const fbsStock = p.stocks.find((s) => s.type === 'fbs');
    const total = (fboStock?.present || 0) + (fbsStock?.present || 0);

    lines.push(
      `| ${p.productId} | ${p.offerId} | ${fboStock?.present || 0} | ${fboStock?.reserved || 0} | ${fbsStock?.present || 0} | ${fbsStock?.reserved || 0} | ${total} |`
    );
  }

  if (products.length > 50) {
    lines.push(`\n... и ещё ${products.length - 50} товаров`);
  }

  // Summary
  const totalFbo = products.reduce((sum, p) => sum + p.totalFbo, 0);
  const totalFbs = products.reduce((sum, p) => sum + p.totalFbs, 0);
  lines.push(`\n**Всего товаров:** ${products.length}`);
  lines.push(`**Всего FBO:** ${totalFbo} шт.`);
  lines.push(`**Всего FBS:** ${totalFbs} шт.`);

  return lines.join('\n');
}

/**
 * Preview type for stock changes
 */
interface StockChangePreview {
  changes: Array<{
    offerId: string;
    warehouseId: number;
    currentStock?: number;
    newStock: number;
  }>;
  toolName: string;
}

/**
 * Write operation result type
 */
interface WriteOperationResult<T> {
  confirmed: boolean;
  preview?: StockChangePreview;
  result: T;
}

function needsConfirmation(preview: StockChangePreview): WriteOperationResult<{ success: boolean; updated: number; errors: string[] }> {
  return {
    confirmed: false,
    preview,
    result: { success: false, updated: 0, errors: [] },
  };
}

function confirmed<T>(result: T): WriteOperationResult<T> {
  return {
    confirmed: true,
    result,
  };
}

/**
 * Update stocks with confirmation system
 * POST /v2/products/stocks
 */
export async function updateStocks(
  input: UpdateStocksInput
): Promise<WriteOperationResult<{ success: boolean; updated: number; errors: string[] }>> {
  const { stocks, confirm } = input;

  if (stocks.length === 0) {
    throw new Error('At least one stock update must be specified');
  }

  // If not confirmed, return preview
  if (!confirm) {
    const preview: StockChangePreview = {
      changes: stocks.map((s) => ({
        offerId: s.offerId,
        warehouseId: s.warehouseId,
        newStock: s.stock,
      })),
      toolName: 'ozon_update_stocks',
    };

    await logWriteWithPreview('ozon_update_stocks', 'stocks', input, preview as unknown as Record<string, unknown>);

    return needsConfirmation(preview);
  }

  // Confirmed - apply changes
  try {
    const result = await fetchOzon<{
      result: Array<{
        warehouse_id: number;
        offer_id: string;
        product_id: number;
        updated: boolean;
        errors: Array<{ code: string; message: string }>;
      }>;
    }>('/v2/products/stocks', {
      stocks: stocks.map((s) => ({
        offer_id: s.offerId,
        warehouse_id: s.warehouseId,
        stock: s.stock,
      })),
    });

    const errors: string[] = [];
    let updated = 0;

    for (const item of result.result || []) {
      if (item.updated) {
        updated++;
      } else {
        const errorMsg = item.errors?.map((e) => e.message).join(', ') || 'Unknown error';
        errors.push(`${item.offer_id}: ${errorMsg}`);
      }
    }

    const preview: StockChangePreview = {
      changes: stocks.map((s) => ({
        offerId: s.offerId,
        warehouseId: s.warehouseId,
        newStock: s.stock,
      })),
      toolName: 'ozon_update_stocks',
    };

    await logWriteConfirmed('ozon_update_stocks', 'stocks', input, { updated, errors }, preview as unknown as Record<string, unknown>);

    return confirmed({
      success: errors.length === 0,
      updated,
      errors,
    });
  } catch (error) {
    await logError('ozon_update_stocks', 'stocks', input, error as Error);
    throw error;
  }
}

/**
 * Format update stocks result for display
 */
export function formatUpdateStocksResult(
  result: WriteOperationResult<{ success: boolean; updated: number; errors: string[] }>
): string {
  if (!result.confirmed && result.preview) {
    const p = result.preview;

    const lines = [
      '## Preview обновления остатков',
      '',
      '| Артикул | Склад ID | Новое количество |',
      '|---------|----------|------------------|',
    ];

    for (const change of p.changes) {
      lines.push(`| ${change.offerId} | ${change.warehouseId} | ${change.newStock} |`);
    }

    lines.push('');
    lines.push('---');
    lines.push('**Для применения изменений вызовите инструмент с `confirm: true`**');

    return lines.join('\n');
  }

  const { success, updated, errors } = result.result;

  const lines = [
    success ? '## Остатки успешно обновлены' : '## Остатки обновлены с ошибками',
    '',
    `**Обновлено:** ${updated} позиций`,
  ];

  if (errors.length > 0) {
    lines.push('');
    lines.push('**Ошибки:**');
    for (const error of errors) {
      lines.push(`- ${error}`);
    }
  }

  return lines.join('\n');
}
