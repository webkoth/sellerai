/**
 * Prices tools for Yandex Market MCP
 */

import { z } from 'zod';
import { apiRequest, getCampaignId, getBusinessId } from '../api/client.js';

// Input schemas
export const GetPricesInputSchema = z.object({
  campaignId: z.number().optional().describe('ID магазина (по умолчанию из env)'),
  offerIds: z.array(z.string()).optional().describe('Фильтр по артикулам'),
  limit: z.number().min(1).max(200).default(100).optional(),
  pageToken: z.string().optional().describe('Токен для пагинации'),
}).strict();

export const UpdatePricesInputSchema = z.object({
  campaignId: z.number().optional().describe('ID магазина (по умолчанию из env)'),
  prices: z.array(z.object({
    offerId: z.string().describe('Артикул товара'),
    price: z.number().describe('Новая цена'),
    oldPrice: z.number().optional().describe('Старая цена (зачёркнутая)'),
    discountBase: z.number().optional().describe('Цена без скидки для расчёта'),
    vat: z.number().optional().describe('НДС: 0, 10, 20'),
  })).describe('Массив обновлений цен'),
  confirm: z.boolean().default(false).describe('true для применения изменений'),
}).strict();

export type GetPricesInput = z.infer<typeof GetPricesInputSchema>;
export type UpdatePricesInput = z.infer<typeof UpdatePricesInputSchema>;

// Response types
interface OfferPrice {
  offerId: string;
  price?: {
    value: number;
    currencyId: string;
    discountBase?: number;
    vat?: number;
  };
  oldPrice?: {
    value: number;
    currencyId: string;
  };
  suggestPrice?: {
    value: number;
    currencyId: string;
  };
  competitorsPrice?: {
    min?: number;
    avg?: number;
    max?: number;
  };
}

interface PricesResponse {
  result?: {
    offers?: OfferPrice[];
    paging?: {
      nextPageToken?: string;
    };
  };
}

// Get prices
export async function getPrices(input: GetPricesInput): Promise<{
  prices: Array<{
    offerId: string;
    price: number;
    oldPrice?: number;
    discountBase?: number;
    suggestPrice?: number;
    minCompetitorPrice?: number;
    currency: string;
    vat?: number;
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

  if (input.pageToken) {
    body.page_token = input.pageToken;
  }

  const response = await apiRequest<PricesResponse>(
    `/v2/campaigns/${campaignId}/offer-prices`,
    'POST',
    body
  );

  const prices = (response.result?.offers || []).map((offer) => ({
    offerId: offer.offerId,
    price: offer.price?.value || 0,
    oldPrice: offer.oldPrice?.value,
    discountBase: offer.price?.discountBase,
    suggestPrice: offer.suggestPrice?.value,
    minCompetitorPrice: offer.competitorsPrice?.min,
    currency: offer.price?.currencyId || 'RUR',
    vat: offer.price?.vat,
  }));

  return {
    prices,
    total: prices.length,
    nextPageToken: response.result?.paging?.nextPageToken,
  };
}

// Update prices
export async function updatePrices(input: UpdatePricesInput): Promise<{
  mode: 'preview' | 'applied';
  changes: Array<{
    offerId: string;
    oldPrice?: number;
    newPrice: number;
  }>;
  errors: Array<{
    offerId: string;
    message: string;
  }>;
}> {
  const campaignId = input.campaignId || parseInt(getCampaignId());

  // Format prices for API
  const offers = input.prices.map((p) => ({
    offerId: p.offerId,
    price: {
      value: p.price,
      currencyId: 'RUR',
      ...(p.discountBase ? { discountBase: p.discountBase } : {}),
      ...(p.vat !== undefined ? { vat: p.vat } : {}),
    },
    ...(p.oldPrice ? { oldPrice: { value: p.oldPrice, currencyId: 'RUR' } } : {}),
  }));

  if (!input.confirm) {
    // Preview mode - get current prices
    const currentPrices = await getPrices({
      campaignId,
      offerIds: input.prices.map((p) => p.offerId),
    });

    const currentPriceMap = new Map(
      currentPrices.prices.map((p) => [p.offerId, p.price])
    );

    return {
      mode: 'preview',
      changes: input.prices.map((p) => ({
        offerId: p.offerId,
        oldPrice: currentPriceMap.get(p.offerId),
        newPrice: p.price,
      })),
      errors: [],
    };
  }

  // Apply changes
  const response = await apiRequest<{
    result?: {
      updatedOfferIds?: string[];
      notUpdatedOfferIds?: string[];
    };
  }>(
    `/v2/campaigns/${campaignId}/offer-prices/updates`,
    'POST',
    { offers }
  );

  const notUpdated = response.result?.notUpdatedOfferIds || [];

  return {
    mode: 'applied',
    changes: input.prices
      .filter((p) => !notUpdated.includes(p.offerId))
      .map((p) => ({
        offerId: p.offerId,
        newPrice: p.price,
      })),
    errors: notUpdated.map((offerId) => ({
      offerId,
      message: 'Не удалось обновить цену',
    })),
  };
}

// Formatters
export function formatPricesAsMarkdown(
  prices: Array<{
    offerId: string;
    price: number;
    oldPrice?: number;
    discountBase?: number;
    suggestPrice?: number;
    minCompetitorPrice?: number;
    currency: string;
    vat?: number;
  }>,
  nextPageToken?: string
): string {
  if (!prices.length) {
    return '## Цены Яндекс.Маркет\n\nЦены не найдены.';
  }

  const lines: string[] = [
    '## Цены Яндекс.Маркет',
    '',
    `Найдено: ${prices.length} товаров`,
    '',
    '| Артикул | Цена | Старая цена | Рек. цена | Мин. конкур. |',
    '|---------|------|-------------|-----------|--------------|',
  ];

  for (const p of prices) {
    const price = `${p.price} ₽`;
    const oldPrice = p.oldPrice ? `${p.oldPrice} ₽` : '-';
    const suggest = p.suggestPrice ? `${p.suggestPrice} ₽` : '-';
    const competitor = p.minCompetitorPrice ? `${p.minCompetitorPrice} ₽` : '-';

    lines.push(`| ${p.offerId} | ${price} | ${oldPrice} | ${suggest} | ${competitor} |`);
  }

  if (nextPageToken) {
    lines.push('');
    lines.push(`> Есть ещё данные. Используйте pageToken: \`${nextPageToken}\``);
  }

  return lines.join('\n');
}

export function formatUpdatePricesResult(result: {
  mode: 'preview' | 'applied';
  changes: Array<{ offerId: string; oldPrice?: number; newPrice: number }>;
  errors: Array<{ offerId: string; message: string }>;
}): string {
  const lines: string[] = [];

  if (result.mode === 'preview') {
    lines.push('## Предпросмотр изменений цен');
    lines.push('');
    lines.push('> Для применения изменений добавьте `confirm: true`');
    lines.push('');
  } else {
    lines.push('## Цены обновлены');
    lines.push('');
  }

  if (result.changes.length > 0) {
    lines.push('### Изменения');
    lines.push('');
    lines.push('| Артикул | Было | Стало |');
    lines.push('|---------|------|-------|');

    for (const c of result.changes) {
      const oldPrice = c.oldPrice !== undefined ? `${c.oldPrice} ₽` : '-';
      lines.push(`| ${c.offerId} | ${oldPrice} | ${c.newPrice} ₽ |`);
    }
  }

  if (result.errors.length > 0) {
    lines.push('');
    lines.push('### Ошибки');
    lines.push('');

    for (const e of result.errors) {
      lines.push(`- **${e.offerId}**: ${e.message}`);
    }
  }

  return lines.join('\n');
}
