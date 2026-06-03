/**
 * Avito Promotions Tools
 *
 * Продвижение: цены VAS, применение услуг, управление ставками.
 */

import { z } from 'zod';
import { fetchAvito, getUserId } from '../api/client.js';

// --- Input Schemas ---

export const GetVasPricesInputSchema = z.object({
  itemIds: z.array(z.number()).describe('ID объявлений'),
});

export type GetVasPricesInput = z.infer<typeof GetVasPricesInputSchema>;

export const ApplyVasInputSchema = z.object({
  itemId: z.number().describe('ID объявления'),
  vasId: z.string().describe('ID услуги (premium, vip, pushup, highlight, xl)'),
  confirm: z.boolean().optional().default(false),
});

export type ApplyVasInput = z.infer<typeof ApplyVasInputSchema>;

export const GetPromotionsInputSchema = z.object({
  itemIds: z.array(z.number()).describe('ID объявлений'),
});

export type GetPromotionsInput = z.infer<typeof GetPromotionsInputSchema>;

export const SetPromotionInputSchema = z.object({
  itemIds: z.array(z.number()).describe('ID объявлений'),
  mode: z.enum(['auto', 'manual']).describe('Режим: auto или manual'),
  budget: z.number().optional().describe('Бюджет (для auto)'),
  bid: z.number().optional().describe('Ставка в копейках (для manual)'),
  confirm: z.boolean().optional().default(false),
});

export type SetPromotionInput = z.infer<typeof SetPromotionInputSchema>;

// --- Response Types ---

interface VasPrice {
  vasId: string;
  name: string;
  price: number;
  period?: number;
}

interface ItemVasPrices {
  itemId: number;
  vas: VasPrice[];
}

interface PromotionInfo {
  itemId: number;
  status: string;
  bid?: number;
  budget?: number;
  mode?: string;
}

// --- API Functions ---

export async function getVasPrices(input: GetVasPricesInput): Promise<{
  items: ItemVasPrices[];
}> {
  const userId = await getUserId();

  const data = await fetchAvito<{
    result?: {
      items?: Array<{
        itemId: number;
        vas?: Array<{
          vas_id: string;
          name?: string;
          price?: number;
          period?: number;
        }>;
      }>;
    };
  }>(
    `/core/v1/accounts/${userId}/price/vas`,
    'POST',
    { itemIds: input.itemIds }
  );

  const items: ItemVasPrices[] = (data.result?.items || []).map(item => ({
    itemId: item.itemId,
    vas: (item.vas || []).map(v => ({
      vasId: v.vas_id,
      name: v.name || v.vas_id,
      price: v.price || 0,
      period: v.period,
    })),
  }));

  return { items };
}

export async function applyVas(input: ApplyVasInput): Promise<{
  confirmed: boolean;
  preview?: { itemId: number; vasId: string };
  result?: unknown;
}> {
  if (!input.confirm) {
    return {
      confirmed: false,
      preview: { itemId: input.itemId, vasId: input.vasId },
    };
  }

  const userId = await getUserId();
  const result = await fetchAvito(
    `/core/v1/accounts/${userId}/items/${input.itemId}/vas`,
    'PUT',
    { vasId: input.vasId }
  );

  return { confirmed: true, result };
}

export async function getPromotions(input: GetPromotionsInput): Promise<{
  promotions: PromotionInfo[];
}> {
  const params = new URLSearchParams();
  for (const id of input.itemIds) {
    params.append('itemIds', String(id));
  }

  const data = await fetchAvito<{
    items?: Array<{
      itemId: number;
      status: string;
      bid?: number;
      budget?: number;
      mode?: string;
    }>;
  }>(`/promotion/v1/items?${params.toString()}`);

  return { promotions: data.items || [] };
}

export async function setPromotion(input: SetPromotionInput): Promise<{
  confirmed: boolean;
  preview?: { itemIds: number[]; mode: string; budget?: number; bid?: number };
  result?: unknown;
}> {
  if (!input.confirm) {
    return {
      confirmed: false,
      preview: {
        itemIds: input.itemIds,
        mode: input.mode,
        budget: input.budget,
        bid: input.bid,
      },
    };
  }

  const endpoint = input.mode === 'auto'
    ? '/promotion/v1/items/auto'
    : '/promotion/v1/items/manual';

  const body: Record<string, unknown> = {
    itemIds: input.itemIds,
  };
  if (input.budget !== undefined) body.budget = input.budget;
  if (input.bid !== undefined) body.bid = input.bid;

  const result = await fetchAvito(endpoint, 'PUT', body);
  return { confirmed: true, result };
}

// --- Markdown Formatters ---

export function formatVasPricesAsMarkdown(items: ItemVasPrices[]): string {
  if (items.length === 0) return '## Услуги продвижения\n\nДанные не найдены.';

  const lines = [
    `## Стоимость услуг продвижения (${items.length} объявлений)`,
    '',
  ];

  for (const item of items) {
    lines.push(`### Объявление ${item.itemId}`, '');
    if (item.vas.length === 0) {
      lines.push('Услуги недоступны.', '');
      continue;
    }

    lines.push(
      '| Услуга | Цена | Период |',
      '|--------|------|--------|',
    );

    for (const v of item.vas) {
      const price = v.price ? `${(v.price / 100).toLocaleString('ru-RU')}₽` : '—';
      const period = v.period ? `${v.period} дн.` : '—';
      lines.push(`| ${v.name} | ${price} | ${period} |`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

export function formatApplyVasResult(result: {
  confirmed: boolean;
  preview?: { itemId: number; vasId: string };
}): string {
  if (!result.confirmed) {
    return [
      '## Preview: Применение услуги',
      '',
      `- **Объявление:** ${result.preview?.itemId}`,
      `- **Услуга:** ${result.preview?.vasId}`,
      '',
      '> Для применения добавьте `confirm: true`',
    ].join('\n');
  }

  return '## Услуга применена';
}

export function formatPromotionsAsMarkdown(promotions: PromotionInfo[]): string {
  if (promotions.length === 0) return '## Продвижение\n\nАктивных продвижений нет.';

  const lines = [
    `## Продвижение (${promotions.length})`,
    '',
    '| ID | Статус | Режим | Ставка | Бюджет |',
    '|----|--------|-------|--------|--------|',
  ];

  for (const p of promotions) {
    const bid = p.bid ? `${(p.bid / 100).toLocaleString('ru-RU')}₽` : '—';
    const budget = p.budget ? `${(p.budget / 100).toLocaleString('ru-RU')}₽` : '—';
    lines.push(`| ${p.itemId} | ${p.status} | ${p.mode || '—'} | ${bid} | ${budget} |`);
  }

  return lines.join('\n');
}

export function formatSetPromotionResult(result: {
  confirmed: boolean;
  preview?: { itemIds: number[]; mode: string; budget?: number; bid?: number };
}): string {
  if (!result.confirmed) {
    const lines = [
      '## Preview: Настройка продвижения',
      '',
      `- **Объявления:** ${result.preview?.itemIds.join(', ')}`,
      `- **Режим:** ${result.preview?.mode}`,
    ];

    if (result.preview?.budget !== undefined) {
      lines.push(`- **Бюджет:** ${(result.preview.budget / 100).toLocaleString('ru-RU')}₽`);
    }
    if (result.preview?.bid !== undefined) {
      lines.push(`- **Ставка:** ${(result.preview.bid / 100).toLocaleString('ru-RU')}₽`);
    }

    lines.push('', '> Для применения добавьте `confirm: true`');
    return lines.join('\n');
  }

  return '## Продвижение настроено';
}
