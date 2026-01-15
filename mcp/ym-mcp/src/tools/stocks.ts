/**
 * Stocks tools for Yandex Market MCP
 */

import { z } from 'zod';
import { apiRequest, getCampaignId } from '../api/client.js';

// Input schemas
export const GetStocksInputSchema = z.object({
  campaignId: z.number().optional().describe('ID магазина (по умолчанию из env)'),
  offerIds: z.array(z.string()).optional().describe('Фильтр по артикулам'),
  warehouseIds: z.array(z.number()).optional().describe('Фильтр по складам'),
  limit: z.number().min(1).max(200).default(100).optional(),
  pageToken: z.string().optional().describe('Токен для пагинации'),
}).strict();

export const UpdateStocksInputSchema = z.object({
  campaignId: z.number().optional().describe('ID магазина (по умолчанию из env)'),
  stocks: z.array(z.object({
    sku: z.string().describe('SKU товара (артикул)'),
    warehouseId: z.number().describe('ID склада'),
    count: z.number().min(0).describe('Количество'),
  })).describe('Массив обновлений остатков'),
  confirm: z.boolean().default(false).describe('true для применения изменений'),
}).strict();

export type GetStocksInput = z.infer<typeof GetStocksInputSchema>;
export type UpdateStocksInput = z.infer<typeof UpdateStocksInputSchema>;

// Response types
interface StockItem {
  count: number;
  type: string; // FIT, DEFECT, EXPIRED, etc.
  updatedAt: string;
}

interface WarehouseStock {
  warehouseId: number;
  items: StockItem[];
}

interface OfferStock {
  offerId: string;
  warehouses: WarehouseStock[];
}

interface StocksResponse {
  result?: {
    warehouses?: Array<{
      warehouseId: number;
      offers?: Array<{
        offerId: string;
        items: StockItem[];
        updatedAt?: string;
      }>;
    }>;
    paging?: {
      nextPageToken?: string;
    };
  };
}

// Get stocks
export async function getStocks(input: GetStocksInput): Promise<{
  stocks: Array<{
    offerId: string;
    warehouseId: number;
    available: number;
    reserved: number;
    defect: number;
    updatedAt: string;
  }>;
  total: number;
  nextPageToken?: string;
}> {
  const campaignId = input.campaignId || parseInt(getCampaignId());

  const body: Record<string, unknown> = {
    limit: input.limit || 100,
  };

  if (input.offerIds?.length) {
    body.offerIds = input.offerIds;
  }

  if (input.warehouseIds?.length) {
    body.warehouseIds = input.warehouseIds;
  }

  if (input.pageToken) {
    body.page_token = input.pageToken;
  }

  const response = await apiRequest<StocksResponse>(
    `/v2/campaigns/${campaignId}/offers/stocks`,
    'POST',
    body
  );

  const stocks: Array<{
    offerId: string;
    warehouseId: number;
    available: number;
    reserved: number;
    defect: number;
    updatedAt: string;
  }> = [];

  for (const warehouse of response.result?.warehouses || []) {
    for (const offer of warehouse.offers || []) {
      let available = 0;
      let reserved = 0;
      let defect = 0;
      let updatedAt = '';

      for (const item of offer.items || []) {
        if (item.type === 'FIT') {
          available = item.count;
        } else if (item.type === 'RESERVED') {
          reserved = item.count;
        } else if (item.type === 'DEFECT') {
          defect = item.count;
        }
        if (item.updatedAt) {
          updatedAt = item.updatedAt;
        }
      }

      stocks.push({
        offerId: offer.offerId,
        warehouseId: warehouse.warehouseId,
        available,
        reserved,
        defect,
        updatedAt: updatedAt || offer.updatedAt || '',
      });
    }
  }

  return {
    stocks,
    total: stocks.length,
    nextPageToken: response.result?.paging?.nextPageToken,
  };
}

// Update stocks
export async function updateStocks(input: UpdateStocksInput): Promise<{
  mode: 'preview' | 'applied';
  changes: Array<{
    sku: string;
    warehouseId: number;
    newCount: number;
  }>;
  errors: Array<{
    sku: string;
    message: string;
  }>;
}> {
  const campaignId = input.campaignId || parseInt(getCampaignId());

  // Format stocks for API
  const skus = input.stocks.map((s) => ({
    sku: s.sku,
    warehouseId: s.warehouseId,
    items: [
      {
        count: s.count,
        type: 'FIT',
        updatedAt: new Date().toISOString(),
      },
    ],
  }));

  if (!input.confirm) {
    // Preview mode
    return {
      mode: 'preview',
      changes: input.stocks.map((s) => ({
        sku: s.sku,
        warehouseId: s.warehouseId,
        newCount: s.count,
      })),
      errors: [],
    };
  }

  // Apply changes
  const response = await apiRequest<{ result?: { notUpdatedOfferIds?: string[] } }>(
    `/v2/campaigns/${campaignId}/offers/stocks`,
    'PUT',
    { skus }
  );

  const notUpdated = response.result?.notUpdatedOfferIds || [];

  return {
    mode: 'applied',
    changes: input.stocks
      .filter((s) => !notUpdated.includes(s.sku))
      .map((s) => ({
        sku: s.sku,
        warehouseId: s.warehouseId,
        newCount: s.count,
      })),
    errors: notUpdated.map((sku) => ({
      sku,
      message: 'Не удалось обновить остаток',
    })),
  };
}

// Formatters
export function formatStocksAsMarkdown(
  stocks: Array<{
    offerId: string;
    warehouseId: number;
    available: number;
    reserved: number;
    defect: number;
    updatedAt: string;
  }>,
  nextPageToken?: string
): string {
  if (!stocks.length) {
    return '## Остатки Яндекс.Маркет\n\nОстатки не найдены.';
  }

  const lines: string[] = [
    '## Остатки Яндекс.Маркет',
    '',
    `Найдено: ${stocks.length} позиций`,
    '',
    '| Артикул | Склад | Доступно | Резерв | Брак | Обновлено |',
    '|---------|-------|----------|--------|------|-----------|',
  ];

  for (const s of stocks) {
    const updated = s.updatedAt
      ? new Date(s.updatedAt).toLocaleDateString('ru-RU')
      : '-';
    lines.push(
      `| ${s.offerId} | ${s.warehouseId} | ${s.available} | ${s.reserved} | ${s.defect} | ${updated} |`
    );
  }

  if (nextPageToken) {
    lines.push('');
    lines.push(`> Есть ещё данные. Используйте pageToken: \`${nextPageToken}\``);
  }

  return lines.join('\n');
}

export function formatUpdateStocksResult(result: {
  mode: 'preview' | 'applied';
  changes: Array<{ sku: string; warehouseId: number; newCount: number }>;
  errors: Array<{ sku: string; message: string }>;
}): string {
  const lines: string[] = [];

  if (result.mode === 'preview') {
    lines.push('## Предпросмотр изменений остатков');
    lines.push('');
    lines.push('> Для применения изменений добавьте `confirm: true`');
    lines.push('');
  } else {
    lines.push('## Остатки обновлены');
    lines.push('');
  }

  if (result.changes.length > 0) {
    lines.push('### Изменения');
    lines.push('');
    lines.push('| SKU | Склад | Новое кол-во |');
    lines.push('|-----|-------|--------------|');

    for (const c of result.changes) {
      lines.push(`| ${c.sku} | ${c.warehouseId} | ${c.newCount} |`);
    }
  }

  if (result.errors.length > 0) {
    lines.push('');
    lines.push('### Ошибки');
    lines.push('');

    for (const e of result.errors) {
      lines.push(`- **${e.sku}**: ${e.message}`);
    }
  }

  return lines.join('\n');
}
