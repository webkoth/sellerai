/**
 * Avito Items Tools
 *
 * Объявления: список, информация, статистика просмотров, звонки, изменение цены.
 */

import { z } from 'zod';
import { fetchAvito, getUserId } from '../api/client.js';

// --- Input Schemas ---

export const GetItemsInputSchema = z.object({
  status: z.enum(['active', 'removed', 'old', 'blocked', 'rejected']).optional(),
  category: z.number().optional().describe('ID категории'),
  perPage: z.number().optional().default(25),
  page: z.number().optional().default(1),
});

export type GetItemsInput = z.infer<typeof GetItemsInputSchema>;

export const GetItemInputSchema = z.object({
  itemId: z.number().describe('ID объявления на Авито'),
});

export type GetItemInput = z.infer<typeof GetItemInputSchema>;

export const GetItemsStatsInputSchema = z.object({
  itemIds: z.array(z.number()).describe('Список ID объявлений (до 200)'),
  dateFrom: z.string().optional().describe('Дата начала (YYYY-MM-DD)'),
  dateTo: z.string().optional().describe('Дата конца (YYYY-MM-DD)'),
});

export type GetItemsStatsInput = z.infer<typeof GetItemsStatsInputSchema>;

export const GetCallsStatsInputSchema = z.object({
  dateFrom: z.string().describe('Дата начала (YYYY-MM-DD)'),
  dateTo: z.string().describe('Дата конца (YYYY-MM-DD)'),
  itemIds: z.array(z.number()).optional().describe('Фильтр по ID объявлений'),
});

export type GetCallsStatsInput = z.infer<typeof GetCallsStatsInputSchema>;

export const UpdateItemPriceInputSchema = z.object({
  itemId: z.number().describe('ID объявления'),
  price: z.number().describe('Новая цена в копейках'),
  confirm: z.boolean().optional().default(false),
});

export type UpdateItemPriceInput = z.infer<typeof UpdateItemPriceInputSchema>;

// --- Response Types ---

interface AvitoItem {
  id: number;
  title: string;
  price: number;
  category?: { id: number; name: string };
  url?: string;
  status?: string;
  stats?: { views?: number; contacts?: number; favorites?: number };
}

interface AvitoItemInfo {
  id: number;
  title: string;
  price: number;
  category?: { id: number; name: string };
  description?: string;
  url?: string;
  status?: string;
  address?: string;
  images?: Array<{ id: number; url: string }>;
  created?: string;
}

interface ItemStats {
  itemId: number;
  stats: Array<{
    date: string;
    uniqViews?: number;
    uniqContacts?: number;
    uniqFavorites?: number;
  }>;
}

interface CallStats {
  itemId: number;
  calls: number;
  new: number;
  answered: number;
  missed: number;
}

// --- API Functions ---

export async function getItems(input: GetItemsInput): Promise<{
  items: AvitoItem[];
  total: number;
}> {
  const params = new URLSearchParams();
  if (input.status) params.set('status', input.status);
  if (input.category) params.set('category', String(input.category));
  params.set('per_page', String(input.perPage));
  params.set('page', String(input.page));

  const query = params.toString();
  const data = await fetchAvito<{
    resources: AvitoItem[];
    meta?: { count?: number; page?: number; per_page?: number };
  }>(`/core/v1/items?${query}`);

  return {
    items: data.resources || [],
    total: data.meta?.count || (data.resources?.length ?? 0),
  };
}

export async function getItem(input: GetItemInput): Promise<{
  item: AvitoItemInfo;
}> {
  const userId = await getUserId();
  const data = await fetchAvito<AvitoItemInfo>(
    `/core/v1/accounts/${userId}/items/${input.itemId}/`
  );

  return { item: data };
}

export async function getItemsStats(input: GetItemsStatsInput): Promise<{
  items: ItemStats[];
}> {
  const userId = await getUserId();

  const now = new Date();
  const dateFrom = input.dateFrom || new Date(now.getTime() - 7 * 86400000).toISOString().split('T')[0];
  const dateTo = input.dateTo || now.toISOString().split('T')[0];

  const data = await fetchAvito<{
    result: {
      items: Array<{
        item_id: number;
        stats: Array<{
          date: string;
          uniqViews?: number;
          uniqContacts?: number;
          uniqFavorites?: number;
        }>;
      }>;
    };
  }>(
    `/stats/v1/accounts/${userId}/items`,
    'POST',
    {
      dateFrom,
      dateTo,
      itemIds: input.itemIds,
      fields: ['uniqViews', 'uniqContacts', 'uniqFavorites'],
    }
  );

  const items: ItemStats[] = (data.result?.items || []).map(i => ({
    itemId: i.item_id,
    stats: i.stats || [],
  }));

  return { items };
}

export async function getCallsStats(input: GetCallsStatsInput): Promise<{
  calls: CallStats[];
}> {
  const userId = await getUserId();

  const data = await fetchAvito<{
    result?: {
      items?: Array<{
        itemId: number;
        calls: number;
        new: number;
        answered: number;
        missed: number;
      }>;
    };
  }>(
    `/core/v1/accounts/${userId}/calls/stats/`,
    'POST',
    {
      dateFrom: input.dateFrom,
      dateTo: input.dateTo,
      itemIds: input.itemIds,
    }
  );

  return { calls: data.result?.items || [] };
}

export async function updateItemPrice(input: UpdateItemPriceInput): Promise<{
  confirmed: boolean;
  preview?: { itemId: number; newPrice: number };
  result?: unknown;
}> {
  if (!input.confirm) {
    return {
      confirmed: false,
      preview: {
        itemId: input.itemId,
        newPrice: input.price,
      },
    };
  }

  const result = await fetchAvito(
    `/core/v1/items/${input.itemId}/update_price`,
    'POST',
    { price: input.price }
  );

  return { confirmed: true, result };
}

// --- Markdown Formatters ---

export function formatItemsAsMarkdown(items: AvitoItem[], total: number): string {
  if (items.length === 0) return '## Объявления Авито\n\nОбъявления не найдены.';

  const lines = [
    `## Объявления Авито (${total})`,
    '',
    '| ID | Название | Цена | Статус | Просмотры | Контакты |',
    '|----|----------|------|--------|-----------|----------|',
  ];

  for (const item of items) {
    const price = item.price ? `${item.price.toLocaleString('ru-RU')}₽` : '—';
    const views = item.stats?.views ?? '—';
    const contacts = item.stats?.contacts ?? '—';
    const status = item.status || '—';
    const title = item.title.length > 40 ? item.title.substring(0, 37) + '...' : item.title;

    lines.push(`| ${item.id} | ${title} | ${price} | ${status} | ${views} | ${contacts} |`);
  }

  return lines.join('\n');
}

export function formatItemAsMarkdown(item: AvitoItemInfo): string {
  const lines = [
    `## ${item.title}`,
    '',
    `- **ID:** ${item.id}`,
    `- **Цена:** ${item.price ? item.price.toLocaleString('ru-RU') + '₽' : '—'}`,
    `- **Статус:** ${item.status || '—'}`,
    `- **Категория:** ${item.category?.name || '—'}`,
  ];

  if (item.address) lines.push(`- **Адрес:** ${item.address}`);
  if (item.url) lines.push(`- **URL:** ${item.url}`);
  if (item.created) lines.push(`- **Создано:** ${item.created}`);
  if (item.description) {
    lines.push('', '### Описание', '', item.description.substring(0, 500));
  }
  if (item.images && item.images.length > 0) {
    lines.push('', `### Фото (${item.images.length})`);
  }

  return lines.join('\n');
}

export function formatItemsStatsAsMarkdown(items: ItemStats[]): string {
  if (items.length === 0) return '## Статистика\n\nДанные не найдены.';

  const lines = [
    `## Статистика объявлений (${items.length})`,
    '',
  ];

  for (const item of items) {
    const totalViews = item.stats.reduce((s, d) => s + (d.uniqViews || 0), 0);
    const totalContacts = item.stats.reduce((s, d) => s + (d.uniqContacts || 0), 0);
    const totalFavorites = item.stats.reduce((s, d) => s + (d.uniqFavorites || 0), 0);

    lines.push(
      `### Объявление ${item.itemId}`,
      `- Просмотры: **${totalViews}**`,
      `- Контакты: **${totalContacts}**`,
      `- В избранном: **${totalFavorites}**`,
      '',
    );
  }

  return lines.join('\n');
}

export function formatCallsStatsAsMarkdown(calls: CallStats[]): string {
  if (calls.length === 0) return '## Звонки\n\nДанные не найдены.';

  const lines = [
    `## Статистика звонков (${calls.length})`,
    '',
    '| ID | Всего | Новые | Отвечено | Пропущено |',
    '|----|-------|-------|----------|-----------|',
  ];

  for (const c of calls) {
    lines.push(`| ${c.itemId} | ${c.calls} | ${c.new} | ${c.answered} | ${c.missed} |`);
  }

  return lines.join('\n');
}

export function formatUpdatePriceResult(result: {
  confirmed: boolean;
  preview?: { itemId: number; newPrice: number };
}): string {
  if (!result.confirmed) {
    return [
      '## Preview: Изменение цены',
      '',
      `- **Объявление:** ${result.preview?.itemId}`,
      `- **Новая цена:** ${result.preview?.newPrice?.toLocaleString('ru-RU')}₽`,
      '',
      '> Для применения добавьте `confirm: true`',
    ].join('\n');
  }

  return '## Цена обновлена';
}
