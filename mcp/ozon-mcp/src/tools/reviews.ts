import { z } from 'zod';
import { createOzonHeaders, OZON_API_URL } from '../utils/auth.js';
import { logRead, logWriteConfirmed } from '../utils/logger.js';

// Input schema for ozon_get_reviews
export const GetReviewsInputSchema = z.object({
  dateFrom: z.string().optional().describe('Start date (YYYY-MM-DD), defaults to 30 days ago'),
  dateTo: z.string().optional().describe('End date (YYYY-MM-DD), defaults to today'),
  status: z.enum(['all', 'processed', 'unprocessed']).optional().default('all')
    .describe('Filter by processing status'),
  rating: z.array(z.number().min(1).max(5)).optional()
    .describe('Filter by rating (1-5)'),
  productIds: z.array(z.number()).optional()
    .describe('Filter by product_id'),
  skus: z.array(z.number()).optional()
    .describe('Filter by SKU'),
  limit: z.number().optional().default(50)
    .describe('Maximum number of reviews to return'),
    
});

export type GetReviewsInput = z.infer<typeof GetReviewsInputSchema>;

// Input schema for ozon_reply_review
export const ReplyReviewInputSchema = z.object({
  reviewId: z.number().describe('Review ID to reply to'),
  text: z.string().min(1).max(1000).describe('Reply text (max 1000 characters)'),
  confirm: z.boolean().optional().default(false)
    .describe('Set to true to actually send the reply'),
});

export type ReplyReviewInput = z.infer<typeof ReplyReviewInputSchema>;

// Review interface
interface OzonReview {
  id: number;
  productId: number;
  sku: number;
  productName: string;
  rating: number;
  text: string;
  comment?: string; // Seller's reply
  pros?: string;
  cons?: string;
  authorName: string;
  createdAt: string;
  isProcessed: boolean;
  images: string[];
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
 * Get reviews from Ozon API
 * POST /v1/review/list
 */
export async function getReviews(input: GetReviewsInput): Promise<{
  reviews: OzonReview[];
  total: number;
  summary: {
    totalReviews: number;
    avgRating: number;
    withoutReply: number;
    negative: number;
    positive: number;
    ratingDistribution: Record<number, number>;
  };
}> {
  const today = new Date();
  const thirtyDaysAgo = new Date(today);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const dateFrom = input.dateFrom || thirtyDaysAgo.toISOString().split('T')[0];
  const dateTo = input.dateTo || today.toISOString().split('T')[0];
  const limit = input.limit || 50;

  const reviews: OzonReview[] = [];
  let lastId: number | undefined;

  while (reviews.length < limit) {
    const body: Record<string, unknown> = {
      date_from: new Date(dateFrom).toISOString(),
      date_to: new Date(dateTo + 'T23:59:59').toISOString(),
      limit: Math.min(100, limit - reviews.length),
      sort_dir: 'desc',
    };

    if (lastId) {
      body.last_id = lastId;
    }

    // Add filters
    if (input.status && input.status !== 'all') {
      body.is_answered = input.status === 'processed';
    }

    if (input.rating && input.rating.length > 0) {
      body.rating = input.rating;
    }

    if (input.productIds && input.productIds.length > 0) {
      body.product_id = input.productIds;
    }

    if (input.skus && input.skus.length > 0) {
      body.sku = input.skus;
    }

    const result = await fetchOzon<{
      reviews: Array<{
        id: number;
        product_id: number;
        sku: number;
        product_name?: string;
        rating: number;
        text: string;
        comment?: {
          text: string;
          created_at: string;
        };
        positive?: string;
        negative?: string;
        author_name?: string;
        created_at: string;
        is_answered: boolean;
        photos?: Array<{
          url: string;
        }>;
      }>;
      has_next: boolean;
      last_id?: number;
    }>('/v1/review/list', body);

    const fetched = result.reviews || [];
    if (fetched.length === 0) break;

    for (const r of fetched) {
      reviews.push({
        id: r.id,
        productId: r.product_id,
        sku: r.sku,
        productName: r.product_name || `SKU ${r.sku}`,
        rating: r.rating,
        text: r.text || '',
        comment: r.comment?.text,
        pros: r.positive,
        cons: r.negative,
        authorName: r.author_name || 'Покупатель',
        createdAt: r.created_at,
        isProcessed: r.is_answered,
        images: r.photos?.map((p) => p.url) || [],
      });
    }

    if (!result.has_next || fetched.length < 100) break;
    lastId = result.last_id;
  }

  // Calculate summary
  const ratingDistribution: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  let totalRating = 0;
  let withoutReply = 0;
  let negative = 0;
  let positive = 0;

  for (const review of reviews) {
    ratingDistribution[review.rating] = (ratingDistribution[review.rating] || 0) + 1;
    totalRating += review.rating;
    if (!review.isProcessed) withoutReply++;
    if (review.rating <= 2) negative++;
    if (review.rating >= 4) positive++;
  }

  const avgRating = reviews.length > 0 ? totalRating / reviews.length : 0;

  await logRead('ozon_get_reviews', 'reviews', input, {
    total: reviews.length,
    avgRating: avgRating.toFixed(1),
    withoutReply,
  });

  return {
    reviews,
    total: reviews.length,
    summary: {
      totalReviews: reviews.length,
      avgRating: Math.round(avgRating * 10) / 10,
      withoutReply,
      negative,
      positive,
      ratingDistribution,
    },
  };
}

/**
 * Reply to a review on Ozon
 * POST /v1/review/comment/create
 */
export async function replyReview(input: ReplyReviewInput): Promise<{
  success: boolean;
  preview: boolean;
  reviewId: number;
  text: string;
  message: string;
}> {
  const { reviewId, text, confirm } = input;

  // Preview mode - just show what would be sent
  if (!confirm) {
    return {
      success: false,
      preview: true,
      reviewId,
      text,
      message: `📝 PREVIEW: Ответ на отзыв #${reviewId}\n\nТекст ответа:\n"${text}"\n\n⚠️ Для отправки добавьте confirm=true`,
    };
  }

  // Actually send the reply
  const result = await fetchOzon<{
    result: boolean;
  }>('/v1/review/comment/create', {
    review_id: reviewId,
    text: text,
  });

  await logWriteConfirmed('ozon_reply_review', 'review_reply', {
    reviewId,
    textLength: text.length,
  }, { success: result.result }, {});

  return {
    success: result.result === true,
    preview: false,
    reviewId,
    text,
    message: result.result
      ? `✅ Ответ на отзыв #${reviewId} успешно отправлен`
      : `❌ Не удалось отправить ответ на отзыв #${reviewId}`,
  };
}

/**
 * Format reviews as markdown
 */
export function formatReviewsAsMarkdown(
  reviews: OzonReview[],
  summary: {
    totalReviews: number;
    avgRating: number;
    withoutReply: number;
    negative: number;
    positive: number;
    ratingDistribution: Record<number, number>;
  }
): string {
  if (reviews.length === 0) {
    return '⭐ Отзывов не найдено за указанный период';
  }

  const ratingEmoji = (r: number) => {
    if (r >= 4) return '🟢';
    if (r === 3) return '🟡';
    return '🔴';
  };

  const stars = (r: number) => '★'.repeat(r) + '☆'.repeat(5 - r);

  const lines = [
    '## ⭐ Отзывы Ozon',
    '',
    '### Сводка',
    `| Показатель | Значение |`,
    `|------------|----------|`,
    `| Всего отзывов | ${summary.totalReviews} |`,
    `| Средняя оценка | ${summary.avgRating} ${stars(Math.round(summary.avgRating))} |`,
    `| Положительные (4-5) | ${summary.positive} |`,
    `| Негативные (1-2) | ${summary.negative} |`,
    `| **Без ответа** | **${summary.withoutReply}** |`,
    '',
    '### Распределение оценок',
    `| Оценка | Кол-во |`,
    `|--------|--------|`,
    `| ★★★★★ | ${summary.ratingDistribution[5] || 0} |`,
    `| ★★★★☆ | ${summary.ratingDistribution[4] || 0} |`,
    `| ★★★☆☆ | ${summary.ratingDistribution[3] || 0} |`,
    `| ★★☆☆☆ | ${summary.ratingDistribution[2] || 0} |`,
    `| ★☆☆☆☆ | ${summary.ratingDistribution[1] || 0} |`,
    '',
    '### Отзывы',
    '',
  ];

  for (const review of reviews.slice(0, 20)) {
    const date = new Date(review.createdAt).toLocaleDateString('ru-RU');
    const emoji = ratingEmoji(review.rating);
    const answered = review.isProcessed ? '✅' : '⚠️ без ответа';

    lines.push(`---`);
    lines.push(`**${emoji} ${stars(review.rating)}** | ${date} | ID: ${review.id} | ${answered}`);
    lines.push(`**Товар:** ${review.productName.slice(0, 50)}`);

    if (review.pros) {
      lines.push(`**👍 Плюсы:** ${review.pros.slice(0, 100)}`);
    }
    if (review.cons) {
      lines.push(`**👎 Минусы:** ${review.cons.slice(0, 100)}`);
    }
    if (review.text) {
      lines.push(`**Комментарий:** ${review.text.slice(0, 200)}${review.text.length > 200 ? '...' : ''}`);
    }
    if (review.comment) {
      lines.push(`**💬 Ваш ответ:** ${review.comment.slice(0, 100)}...`);
    }
    lines.push('');
  }

  if (reviews.length > 20) {
    lines.push(`... и ещё ${reviews.length - 20} отзывов`);
  }

  return lines.join('\n');
}

/**
 * Format reply result as markdown
 */
export function formatReplyResultAsMarkdown(result: {
  success: boolean;
  preview: boolean;
  reviewId: number;
  text: string;
  message: string;
}): string {
  return result.message;
}
