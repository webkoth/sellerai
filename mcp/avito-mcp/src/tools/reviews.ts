/**
 * Avito Reviews Tools
 *
 * Отзывы: список, ответы.
 */

import { z } from 'zod';
import { fetchAvito } from '../api/client.js';

// --- Input Schemas ---

export const GetReviewsInputSchema = z.object({
  offset: z.number().optional().default(0),
  limit: z.number().optional().default(50),
});

export type GetReviewsInput = z.infer<typeof GetReviewsInputSchema>;

export const ReplyReviewInputSchema = z.object({
  reviewId: z.number().describe('ID отзыва'),
  text: z.string().describe('Текст ответа'),
  confirm: z.boolean().optional().default(false),
});

export type ReplyReviewInput = z.infer<typeof ReplyReviewInputSchema>;

// --- Response Types ---

interface AvitoReview {
  id: number;
  itemId?: number;
  rating: number;
  text: string;
  created: string;
  sender?: { name: string };
  answer?: { text: string; created: string };
}

// --- API Functions ---

export async function getReviews(input: GetReviewsInput): Promise<{
  reviews: AvitoReview[];
  total: number;
  summary: { avgRating: number; withAnswer: number; withoutAnswer: number };
}> {
  const params = new URLSearchParams();
  params.set('offset', String(input.offset));
  params.set('limit', String(input.limit));

  const data = await fetchAvito<{
    reviews?: Array<{
      id: number;
      item_id?: number;
      score?: number;
      text?: string;
      created?: string;
      sender?: { name?: string };
      answer?: { text?: string; created?: string };
    }>;
    meta?: { total?: number };
  }>(`/ratings/v1/reviews?${params.toString()}`);

  const reviews: AvitoReview[] = (data.reviews || []).map(r => ({
    id: r.id,
    itemId: r.item_id,
    rating: r.score || 0,
    text: r.text || '',
    created: r.created || '',
    sender: r.sender?.name ? { name: r.sender.name } : undefined,
    answer: r.answer ? { text: r.answer.text || '', created: r.answer.created || '' } : undefined,
  }));

  const total = data.meta?.total || reviews.length;
  const withAnswer = reviews.filter(r => r.answer).length;
  const withoutAnswer = reviews.filter(r => !r.answer).length;
  const avgRating = reviews.length > 0
    ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
    : 0;

  return {
    reviews,
    total,
    summary: {
      avgRating: Math.round(avgRating * 10) / 10,
      withAnswer,
      withoutAnswer,
    },
  };
}

export async function replyReview(input: ReplyReviewInput): Promise<{
  confirmed: boolean;
  preview?: { reviewId: number; text: string };
  result?: unknown;
}> {
  if (!input.confirm) {
    return {
      confirmed: false,
      preview: { reviewId: input.reviewId, text: input.text },
    };
  }

  const result = await fetchAvito(
    '/ratings/v1/answers',
    'POST',
    { reviewId: input.reviewId, body: input.text }
  );

  return { confirmed: true, result };
}

// --- Markdown Formatters ---

export function formatReviewsAsMarkdown(
  reviews: AvitoReview[],
  total: number,
  summary: { avgRating: number; withAnswer: number; withoutAnswer: number }
): string {
  const lines = [
    `## Отзывы Авито (${total})`,
    '',
    `- Средний рейтинг: **${summary.avgRating}** / 5`,
    `- С ответом: **${summary.withAnswer}** | Без ответа: **${summary.withoutAnswer}**`,
    '',
  ];

  if (reviews.length === 0) {
    lines.push('Отзывов нет.');
    return lines.join('\n');
  }

  for (const r of reviews) {
    const stars = '★'.repeat(r.rating) + '☆'.repeat(5 - r.rating);
    const sender = r.sender?.name || 'Аноним';
    const date = r.created ? r.created.split('T')[0] : '';

    lines.push(`### ${stars} — ${sender} (${date})`);
    lines.push(`> ID: ${r.id}${r.itemId ? ` | Объявление: ${r.itemId}` : ''}`);
    lines.push('');
    if (r.text) lines.push(r.text.substring(0, 300));

    if (r.answer) {
      lines.push('', `**Ваш ответ:** ${r.answer.text.substring(0, 200)}`);
    } else {
      lines.push('', '**Ответ:** не отвечено');
    }
    lines.push('---', '');
  }

  return lines.join('\n');
}

export function formatReplyResult(result: {
  confirmed: boolean;
  preview?: { reviewId: number; text: string };
}): string {
  if (!result.confirmed) {
    return [
      '## Preview: Ответ на отзыв',
      '',
      `- **Отзыв ID:** ${result.preview?.reviewId}`,
      `- **Текст ответа:** ${result.preview?.text}`,
      '',
      '> Для отправки добавьте `confirm: true`',
    ].join('\n');
  }

  return '## Ответ на отзыв отправлен';
}
