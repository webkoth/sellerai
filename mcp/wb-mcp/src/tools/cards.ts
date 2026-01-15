import { z } from 'zod';
import { createWBHeaders, WB_API_URLS } from '../utils/auth.js';
import { cacheProduct } from '../db/postgres.js';
import { logRead } from '../utils/logger.js';

// Input schema for wb_get_cards
export const GetCardsInputSchema = z.object({
  nmIds: z.array(z.number()).optional().describe('Filter by specific nmIds'),
  vendorCodes: z.array(z.string()).optional().describe('Filter by vendor codes (SKUs)'),
  limit: z.number().optional().default(100).describe('Maximum number of cards to return'),
  withPhoto: z.boolean().optional().default(true).describe('Filter: -1=all, 0=without photo, 1=with photo'),
});

export type GetCardsInput = z.infer<typeof GetCardsInputSchema>;

// Input schema for wb_update_card
export const UpdateCardInputSchema = z.object({
  nmId: z.number().describe('Артикул WB (nmId)'),
  vendorCode: z.string().optional().describe('Артикул продавца (если не передан, будет получен из карточки)'),
  title: z.string().optional().describe('Новое название'),
  description: z.string().optional().describe('Новое описание'),
  characteristics: z.array(
    z.object({
      id: z.number(),
      value: z.union([z.string(), z.array(z.string())]),
    })
  ).optional().describe('Характеристики для обновления (требуют ID характеристики)'),
  dimensions: z.object({
    length: z.number(),
    width: z.number(),
    height: z.number(),
  }).optional().describe('Габариты упаковки'),
});

export type UpdateCardInput = z.infer<typeof UpdateCardInputSchema>;

// Card data interface
interface CardData {
  nmId: number;
  imtId: number;
  vendorCode: string;
  subjectId: number;
  subjectName: string;
  brand: string;
  title: string;
  description?: string;
  photos: string[];
  video?: string;
  dimensions?: {
    length: number;
    width: number;
    height: number;
  };
  characteristics: Array<{
    id: number;
    name: string;
    value: string | string[];
  }>;
  sizes: Array<{
    techSize: string;
    wbSize: string;
    skus: string[];
  }>;
  createdAt: string;
  updatedAt: string;
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
 * Get product cards from WB Content API
 */
export async function getCards(input: GetCardsInput): Promise<{
  cards: CardData[];
  total: number;
}> {
  const { nmIds, vendorCodes, limit, withPhoto } = input;
  const url = `${WB_API_URLS.content}/content/v2/get/cards/list`;
  const allCards: CardData[] = [];

  let cursor: Record<string, unknown> = { limit: Math.min(100, limit) };

  while (allCards.length < limit) {
    const filter: Record<string, unknown> = {
      withPhoto: withPhoto ? 1 : -1,
    };

    // Add nmIds filter if specified
    if (nmIds && nmIds.length > 0) {
      filter.nmID = nmIds;
    }

    // Add vendorCodes filter if specified
    if (vendorCodes && vendorCodes.length > 0) {
      filter.vendorCode = vendorCodes;
    }

    const result = await fetchWB<{
      cards?: Array<{
        nmID: number;
        imtID: number;
        vendorCode: string;
        subjectID: number;
        subjectName: string;
        brand: string;
        title: string;
        description?: string;
        photos: Array<{ big: string; c246x328: string; c516x688: string }>;
        video?: string;
        dimensions?: { length: number; width: number; height: number };
        characteristics: Array<{ id: number; name: string; value: string | string[] }>;
        sizes: Array<{ techSize: string; wbSize: string; skus: string[] }>;
        createdAt: string;
        updatedAt: string;
      }>;
      cursor?: {
        total: number;
        updatedAt?: string;
        nmID?: number;
      };
    }>(url, {
      method: 'POST',
      body: JSON.stringify({
        settings: {
          cursor,
          filter,
        },
      }),
    });

    const cards = result.cards || [];
    if (cards.length === 0) break;

    for (const card of cards) {
      const cardData: CardData = {
        nmId: card.nmID,
        imtId: card.imtID,
        vendorCode: card.vendorCode,
        subjectId: card.subjectID,
        subjectName: card.subjectName,
        brand: card.brand,
        title: card.title,
        description: card.description,
        photos: card.photos?.map((p) => p.big) || [],
        video: card.video,
        dimensions: card.dimensions,
        characteristics: card.characteristics || [],
        sizes: card.sizes || [],
        createdAt: card.createdAt,
        updatedAt: card.updatedAt,
      };

      allCards.push(cardData);

      // Cache card data
      await cacheProduct({
        marketplace: 'wb',
        nmId: card.nmID.toString(),
        sku: card.vendorCode,
        name: card.title,
        brand: card.brand,
        category: card.subjectName,
        rawData: cardData as unknown as Record<string, unknown>,
      });

      if (allCards.length >= limit) break;
    }

    const total = result.cursor?.total || 0;
    if (total < (cursor.limit as number)) break;

    cursor = {
      limit: Math.min(100, limit - allCards.length),
      updatedAt: result.cursor?.updatedAt,
      nmID: result.cursor?.nmID,
    };
  }

  await logRead('wb_get_cards', 'cards', input, { count: allCards.length });

  return {
    cards: allCards,
    total: allCards.length,
  };
}

/**
 * Update product card content
 * Uses Read-Modify-Write strategy to avoid data loss
 */
export async function updateCard(input: UpdateCardInput): Promise<{
  success: boolean;
  message?: string;
  updatedCard?: CardData;
}> {
  const { nmId, ...updates } = input;

  // 1. Get existing card
  const existing = await getCards({
    nmIds: [nmId],
    limit: 1,
    withPhoto: true // We need full data
  });

  if (existing.cards.length === 0) {
    throw new Error(`Карточка с nmId ${nmId} не найдена`);
  }

  const card = existing.cards[0];

  // 2. Prepare update payload
  // Merge updates into existing data
  const payload = {
    nmID: card.nmId,
    vendorCode: updates.vendorCode || card.vendorCode,
    brand: card.brand,
    title: updates.title || card.title,
    description: updates.description || card.description,
    dimensions: updates.dimensions || card.dimensions,
    characteristics: card.characteristics, // Default to existing
    sizes: card.sizes, // Sizes are usually handled separately or preserved
  };

  // Update characteristics if provided
  if (updates.characteristics) {
    // Create a map of existing chars for easy lookup
    const charMap = new Map(card.characteristics.map(c => [c.id, c]));
    
    // Apply updates
    updates.characteristics.forEach(u => {
      // Find existing char to preserve name if needed, or just update value
      // Note: WB API needs 'id' and 'value'. 'name' is often ignored in update but returned in get
      if (charMap.has(u.id)) {
        const existingChar = charMap.get(u.id)!;
        charMap.set(u.id, { ...existingChar, value: u.value });
      } else {
         // If it's a new characteristic we don't know the name, but API might accept just ID
         // We'll trust the input ID is correct
         charMap.set(u.id, { id: u.id, name: '', value: u.value });
      }
    });

    payload.characteristics = Array.from(charMap.values());
  }

  // 3. Send update
  const url = `${WB_API_URLS.content}/content/v2/cards/update`;
  
  // WB expects array of cards
  await fetchWB(url, {
    method: 'POST',
    body: JSON.stringify([payload]),
  });

  await logRead('wb_update_card', 'cards', input, { success: true });

  return {
    success: true,
    message: 'Карточка успешно обновлена',
    updatedCard: {
      ...card,
      ...updates,
      characteristics: payload.characteristics
    }
  };
}

/**
 * Format cards as markdown table
 */
export function formatCardsAsMarkdown(cards: CardData[]): string {
  if (cards.length === 0) {
    return 'Карточки не найдены';
  }

  const lines = [
    '| nmId | Артикул | Название | Бренд | Категория | Фото | Размеры |',
    '|------|---------|----------|-------|-----------|------|---------|',
  ];

  for (const c of cards.slice(0, 50)) {
    const name = c.title.substring(0, 25);
    const photoCount = c.photos?.length || 0;
    const sizeCount = c.sizes?.length || 0;
    lines.push(
      `| ${c.nmId} | ${c.vendorCode} | ${name} | ${c.brand} | ${c.subjectName} | ${photoCount} | ${sizeCount} |`
    );
  }

  if (cards.length > 50) {
    lines.push(`\n... и ещё ${cards.length - 50} карточек`);
  }

  lines.push(`\n**Всего карточек:** ${cards.length}`);

  return lines.join('\n');
}
