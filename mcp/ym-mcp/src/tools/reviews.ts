/**
 * Reviews tools for Yandex Market MCP
 */

import { z } from 'zod';
import { apiRequest, getBusinessId } from '../api/client.js';

// Input schemas
export const GetReviewsInputSchema = z.object({
  businessId: z.number().optional().describe('ID кабинета (по умолчанию из env)'),
  offerIds: z.array(z.string()).optional().describe('Фильтр по артикулам'),
  dateFrom: z.string().optional().describe('Дата начала (YYYY-MM-DD)'),
  dateTo: z.string().optional().describe('Дата конца (YYYY-MM-DD)'),
  rating: z.array(z.number().min(1).max(5)).optional().describe('Фильтр по оценкам (1-5)'),
  needReaction: z.boolean().optional().describe('Только требующие ответа'),
  limit: z.number().min(1).max(200).default(50).optional(),
  pageToken: z.string().optional().describe('Токен для пагинации'),
}).strict();

export const ReplyReviewInputSchema = z.object({
  businessId: z.number().optional().describe('ID кабинета (по умолчанию из env)'),
  feedbackId: z.number().describe('ID отзыва'),
  text: z.string().min(1).max(4000).describe('Текст ответа'),
  confirm: z.boolean().default(false).describe('true для отправки ответа'),
}).strict();

export type GetReviewsInput = z.infer<typeof GetReviewsInputSchema>;
export type ReplyReviewInput = z.infer<typeof ReplyReviewInputSchema>;

// Response types
interface Review {
  feedbackId: number;
  createdAt: string;
  offerId: string;
  offerName?: string;
  author?: {
    name?: string;
    id?: number;
  };
  rating: number;
  text?: string;
  pros?: string;
  cons?: string;
  photos?: string[];
  state?: string;
  comments?: Array<{
    id: number;
    text: string;
    createdAt: string;
    author?: {
      name?: string;
      type?: string;
    };
  }>;
  needReaction?: boolean;
}

interface ReviewsResponse {
  result?: {
    feedbacks?: Review[];
    paging?: {
      nextPageToken?: string;
    };
  };
}

// Get reviews
export async function getReviews(input: GetReviewsInput): Promise<{
  reviews: Array<{
    id: number;
    createdAt: string;
    offerId: string;
    offerName: string;
    authorName: string;
    rating: number;
    text: string;
    pros: string;
    cons: string;
    hasPhotos: boolean;
    needReaction: boolean;
    hasReply: boolean;
  }>;
  summary: {
    total: number;
    avgRating: number;
    needReaction: number;
    byRating: Record<number, number>;
  };
  nextPageToken?: string;
}> {
  const businessId = input.businessId || parseInt(getBusinessId());

  const body: Record<string, unknown> = {
    limit: input.limit || 50,
  };

  if (input.offerIds?.length) {
    body.offerIds = input.offerIds;
  }

  if (input.dateFrom) {
    body.dateFrom = input.dateFrom;
  }

  if (input.dateTo) {
    body.dateTo = input.dateTo;
  }

  if (input.rating?.length) {
    body.rating = input.rating;
  }

  if (input.needReaction !== undefined) {
    body.needReaction = input.needReaction;
  }

  if (input.pageToken) {
    body.page_token = input.pageToken;
  }

  const response = await apiRequest<ReviewsResponse>(
    `/v2/businesses/${businessId}/goods-feedback`,
    'POST',
    body
  );

  const reviews = (response.result?.feedbacks || []).map((review) => ({
    id: review.feedbackId,
    createdAt: review.createdAt,
    offerId: review.offerId,
    offerName: review.offerName || '',
    authorName: review.author?.name || 'Аноним',
    rating: review.rating,
    text: review.text || '',
    pros: review.pros || '',
    cons: review.cons || '',
    hasPhotos: (review.photos?.length || 0) > 0,
    needReaction: review.needReaction || false,
    hasReply: (review.comments?.filter((c) => c.author?.type === 'SHOP')?.length || 0) > 0,
  }));

  // Calculate summary
  const byRating: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  let totalRating = 0;
  let needReactionCount = 0;

  for (const review of reviews) {
    byRating[review.rating] = (byRating[review.rating] || 0) + 1;
    totalRating += review.rating;
    if (review.needReaction) {
      needReactionCount++;
    }
  }

  return {
    reviews,
    summary: {
      total: reviews.length,
      avgRating: reviews.length > 0 ? Math.round((totalRating / reviews.length) * 10) / 10 : 0,
      needReaction: needReactionCount,
      byRating,
    },
    nextPageToken: response.result?.paging?.nextPageToken,
  };
}

// Reply to review
export async function replyReview(input: ReplyReviewInput): Promise<{
  mode: 'preview' | 'sent';
  feedbackId: number;
  text: string;
  success: boolean;
  error?: string;
}> {
  const businessId = input.businessId || parseInt(getBusinessId());

  if (!input.confirm) {
    // Preview mode
    return {
      mode: 'preview',
      feedbackId: input.feedbackId,
      text: input.text,
      success: true,
    };
  }

  // Send reply
  try {
    await apiRequest<{ status?: string }>(
      `/v2/businesses/${businessId}/goods-feedback/comments/update`,
      'POST',
      {
        feedbackId: input.feedbackId,
        comment: {
          text: input.text,
        },
      }
    );

    return {
      mode: 'sent',
      feedbackId: input.feedbackId,
      text: input.text,
      success: true,
    };
  } catch (error) {
    return {
      mode: 'sent',
      feedbackId: input.feedbackId,
      text: input.text,
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// Formatters
function getRatingEmoji(rating: number): string {
  const stars = '⭐'.repeat(rating) + '☆'.repeat(5 - rating);
  return stars;
}

export function formatReviewsAsMarkdown(
  reviews: Array<{
    id: number;
    createdAt: string;
    offerId: string;
    offerName: string;
    authorName: string;
    rating: number;
    text: string;
    pros: string;
    cons: string;
    hasPhotos: boolean;
    needReaction: boolean;
    hasReply: boolean;
  }>,
  summary: {
    total: number;
    avgRating: number;
    needReaction: number;
    byRating: Record<number, number>;
  },
  nextPageToken?: string
): string {
  const lines: string[] = [
    '## Отзывы Яндекс.Маркет',
    '',
  ];

  // Summary
  lines.push('### Сводка');
  lines.push('');
  lines.push(`- **Всего отзывов:** ${summary.total}`);
  lines.push(`- **Средний рейтинг:** ${summary.avgRating} ${getRatingEmoji(Math.round(summary.avgRating))}`);
  lines.push(`- **Требуют ответа:** ${summary.needReaction}`);
  lines.push('');

  // Rating breakdown
  lines.push('**По оценкам:**');
  for (let i = 5; i >= 1; i--) {
    const count = summary.byRating[i] || 0;
    lines.push(`- ${'⭐'.repeat(i)}: ${count}`);
  }
  lines.push('');

  if (!reviews.length) {
    lines.push('Отзывы не найдены.');
    return lines.join('\n');
  }

  // Reviews list
  lines.push('### Отзывы');
  lines.push('');

  for (const review of reviews.slice(0, 20)) {
    const date = new Date(review.createdAt).toLocaleDateString('ru-RU');
    const needReaction = review.needReaction && !review.hasReply ? ' 🔴 **Требует ответа**' : '';
    const hasReply = review.hasReply ? ' ✅' : '';

    lines.push(`#### ${getRatingEmoji(review.rating)} от ${review.authorName}${needReaction}${hasReply}`);
    lines.push(`*${date} • ${review.offerId} • ID: ${review.id}*`);
    lines.push('');

    if (review.text) {
      lines.push(review.text);
      lines.push('');
    }

    if (review.pros) {
      lines.push(`✅ **Достоинства:** ${review.pros}`);
    }

    if (review.cons) {
      lines.push(`❌ **Недостатки:** ${review.cons}`);
    }

    if (review.hasPhotos) {
      lines.push('📷 *Есть фото*');
    }

    lines.push('');
    lines.push('---');
    lines.push('');
  }

  if (reviews.length > 20) {
    lines.push(`> Показаны первые 20 из ${reviews.length} отзывов`);
  }

  if (nextPageToken) {
    lines.push('');
    lines.push(`> Есть ещё отзывы. Используйте pageToken: \`${nextPageToken}\``);
  }

  return lines.join('\n');
}

export function formatReplyResult(result: {
  mode: 'preview' | 'sent';
  feedbackId: number;
  text: string;
  success: boolean;
  error?: string;
}): string {
  const lines: string[] = [];

  if (result.mode === 'preview') {
    lines.push('## Предпросмотр ответа на отзыв');
    lines.push('');
    lines.push('> Для отправки ответа добавьте `confirm: true`');
    lines.push('');
    lines.push(`**ID отзыва:** ${result.feedbackId}`);
    lines.push('');
    lines.push('**Текст ответа:**');
    lines.push('');
    lines.push(result.text);
  } else {
    if (result.success) {
      lines.push('## ✅ Ответ отправлен');
      lines.push('');
      lines.push(`**ID отзыва:** ${result.feedbackId}`);
      lines.push('');
      lines.push('**Текст ответа:**');
      lines.push('');
      lines.push(result.text);
    } else {
      lines.push('## ❌ Ошибка отправки ответа');
      lines.push('');
      lines.push(`**ID отзыва:** ${result.feedbackId}`);
      lines.push('');
      lines.push(`**Ошибка:** ${result.error}`);
    }
  }

  return lines.join('\n');
}
