#!/usr/bin/env node
/**
 * Avito MCP Server
 *
 * Provides tools for managing Avito API:
 * - Items (listings, info, stats, calls, prices)
 * - Promotions (VAS, bids, auto/manual)
 * - Reviews (list, reply)
 * - User (profile, balance)
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

import 'dotenv/config';

// Import tools
import {
  GetItemsInputSchema,
  GetItemInputSchema,
  GetItemsStatsInputSchema,
  GetCallsStatsInputSchema,
  UpdateItemPriceInputSchema,
  getItems,
  getItem,
  getItemsStats,
  getCallsStats,
  updateItemPrice,
  formatItemsAsMarkdown,
  formatItemAsMarkdown,
  formatItemsStatsAsMarkdown,
  formatCallsStatsAsMarkdown,
  formatUpdatePriceResult,
} from './tools/items.js';

import {
  GetVasPricesInputSchema,
  ApplyVasInputSchema,
  GetPromotionsInputSchema,
  SetPromotionInputSchema,
  getVasPrices,
  applyVas,
  getPromotions,
  setPromotion,
  formatVasPricesAsMarkdown,
  formatApplyVasResult,
  formatPromotionsAsMarkdown,
  formatSetPromotionResult,
} from './tools/promotions.js';

import {
  GetReviewsInputSchema,
  ReplyReviewInputSchema,
  getReviews,
  replyReview,
  formatReviewsAsMarkdown,
  formatReplyResult,
} from './tools/reviews.js';

import {
  GetUserInfoInputSchema,
  getUserInfo,
  formatUserInfoAsMarkdown,
} from './tools/user.js';

// Create server
const server = new Server(
  {
    name: 'avito-mcp',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    // Items
    {
      name: 'avito_get_items',
      description:
        'Получить список объявлений Авито. ' +
        'Возвращает ID, название, цену, статус, просмотры.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          status: {
            type: 'string',
            enum: ['active', 'removed', 'old', 'blocked', 'rejected'],
            description: 'Фильтр по статусу',
          },
          category: {
            type: 'number',
            description: 'ID категории',
          },
          perPage: {
            type: 'number',
            description: 'Количество на странице (по умолчанию 25)',
            default: 25,
          },
          page: {
            type: 'number',
            description: 'Номер страницы (по умолчанию 1)',
            default: 1,
          },
        },
      },
    },
    {
      name: 'avito_get_item',
      description:
        'Получить детальную информацию об объявлении Авито по ID. ' +
        'Возвращает название, цену, описание, фото, статус.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          itemId: {
            type: 'number',
            description: 'ID объявления',
          },
        },
        required: ['itemId'],
      },
    },
    {
      name: 'avito_get_items_stats',
      description:
        'Получить статистику просмотров объявлений Авито. ' +
        'Возвращает уникальные просмотры, контакты, добавления в избранное.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          itemIds: {
            type: 'array',
            items: { type: 'number' },
            description: 'Список ID объявлений (до 200)',
          },
          dateFrom: {
            type: 'string',
            description: 'Дата начала (YYYY-MM-DD), по умолчанию 7 дней назад',
          },
          dateTo: {
            type: 'string',
            description: 'Дата конца (YYYY-MM-DD), по умолчанию сегодня',
          },
        },
        required: ['itemIds'],
      },
    },
    {
      name: 'avito_get_calls_stats',
      description:
        'Получить статистику звонков по объявлениям Авито. ' +
        'Возвращает общее количество, новые, отвеченные, пропущенные.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          dateFrom: {
            type: 'string',
            description: 'Дата начала (YYYY-MM-DD)',
          },
          dateTo: {
            type: 'string',
            description: 'Дата конца (YYYY-MM-DD)',
          },
          itemIds: {
            type: 'array',
            items: { type: 'number' },
            description: 'Фильтр по ID объявлений',
          },
        },
        required: ['dateFrom', 'dateTo'],
      },
    },
    {
      name: 'avito_update_item_price',
      description:
        'Изменить цену объявления Авито. ' +
        'ВАЖНО: Без параметра confirm=true показывает preview изменений. ' +
        'С confirm=true применяет изменения.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          itemId: {
            type: 'number',
            description: 'ID объявления',
          },
          price: {
            type: 'number',
            description: 'Новая цена в копейках',
          },
          confirm: {
            type: 'boolean',
            description: 'true для применения изменений',
            default: false,
          },
        },
        required: ['itemId', 'price'],
      },
    },

    // Promotions
    {
      name: 'avito_get_vas_prices',
      description:
        'Получить стоимость услуг продвижения Авито (VAS). ' +
        'Возвращает цены на премиум, VIP, поднятие, выделение, XL.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          itemIds: {
            type: 'array',
            items: { type: 'number' },
            description: 'ID объявлений',
          },
        },
        required: ['itemIds'],
      },
    },
    {
      name: 'avito_apply_vas',
      description:
        'Применить услугу продвижения (VAS) к объявлению Авито. ' +
        'ВАЖНО: Без confirm=true показывает preview. С confirm=true применяет.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          itemId: {
            type: 'number',
            description: 'ID объявления',
          },
          vasId: {
            type: 'string',
            description: 'ID услуги (premium, vip, pushup, highlight, xl)',
          },
          confirm: {
            type: 'boolean',
            description: 'true для применения',
            default: false,
          },
        },
        required: ['itemId', 'vasId'],
      },
    },
    {
      name: 'avito_get_promotions',
      description:
        'Получить активные продвижения объявлений Авито. ' +
        'Возвращает статус, режим, ставку и бюджет.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          itemIds: {
            type: 'array',
            items: { type: 'number' },
            description: 'ID объявлений',
          },
        },
        required: ['itemIds'],
      },
    },
    {
      name: 'avito_set_promotion',
      description:
        'Настроить продвижение объявлений Авито (авто или ручное). ' +
        'ВАЖНО: Без confirm=true показывает preview. С confirm=true применяет.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          itemIds: {
            type: 'array',
            items: { type: 'number' },
            description: 'ID объявлений',
          },
          mode: {
            type: 'string',
            enum: ['auto', 'manual'],
            description: 'Режим: auto (автопродвижение) или manual (ручные ставки)',
          },
          budget: {
            type: 'number',
            description: 'Бюджет в копейках (для auto)',
          },
          bid: {
            type: 'number',
            description: 'Ставка в копейках (для manual)',
          },
          confirm: {
            type: 'boolean',
            description: 'true для применения',
            default: false,
          },
        },
        required: ['itemIds', 'mode'],
      },
    },

    // Reviews
    {
      name: 'avito_get_reviews',
      description:
        'Получить отзывы продавца на Авито. ' +
        'Возвращает оценки, тексты, ответы, сводку по рейтингу.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          offset: {
            type: 'number',
            description: 'Смещение (по умолчанию 0)',
            default: 0,
          },
          limit: {
            type: 'number',
            description: 'Количество (по умолчанию 50)',
            default: 50,
          },
        },
      },
    },
    {
      name: 'avito_reply_review',
      description:
        'Ответить на отзыв на Авито. ' +
        'ВАЖНО: Без confirm=true показывает preview. С confirm=true отправляет.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          reviewId: {
            type: 'number',
            description: 'ID отзыва',
          },
          text: {
            type: 'string',
            description: 'Текст ответа',
          },
          confirm: {
            type: 'boolean',
            description: 'true для отправки',
            default: false,
          },
        },
        required: ['reviewId', 'text'],
      },
    },

    // User
    {
      name: 'avito_get_user_info',
      description:
        'Получить информацию о профиле Авито. ' +
        'Возвращает имя, баланс, последние операции.',
      inputSchema: {
        type: 'object' as const,
        properties: {},
      },
    },
  ],
}));

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      // Items
      case 'avito_get_items': {
        const input = GetItemsInputSchema.parse(args || {});
        const result = await getItems(input);
        const markdown = formatItemsAsMarkdown(result.items, result.total);

        return {
          content: [{ type: 'text', text: markdown }],
          structuredContent: {
            total: result.total,
            items: result.items.slice(0, 30),
          },
        };
      }

      case 'avito_get_item': {
        const input = GetItemInputSchema.parse(args || {});
        const result = await getItem(input);
        const markdown = formatItemAsMarkdown(result.item);

        return {
          content: [{ type: 'text', text: markdown }],
          structuredContent: result,
        };
      }

      case 'avito_get_items_stats': {
        const input = GetItemsStatsInputSchema.parse(args || {});
        const result = await getItemsStats(input);
        const markdown = formatItemsStatsAsMarkdown(result.items);

        return {
          content: [{ type: 'text', text: markdown }],
          structuredContent: result,
        };
      }

      case 'avito_get_calls_stats': {
        const input = GetCallsStatsInputSchema.parse(args || {});
        const result = await getCallsStats(input);
        const markdown = formatCallsStatsAsMarkdown(result.calls);

        return {
          content: [{ type: 'text', text: markdown }],
          structuredContent: result,
        };
      }

      case 'avito_update_item_price': {
        const input = UpdateItemPriceInputSchema.parse(args || {});
        const result = await updateItemPrice(input);
        const markdown = formatUpdatePriceResult(result);

        return {
          content: [{ type: 'text', text: markdown }],
          structuredContent: result,
        };
      }

      // Promotions
      case 'avito_get_vas_prices': {
        const input = GetVasPricesInputSchema.parse(args || {});
        const result = await getVasPrices(input);
        const markdown = formatVasPricesAsMarkdown(result.items);

        return {
          content: [{ type: 'text', text: markdown }],
          structuredContent: result,
        };
      }

      case 'avito_apply_vas': {
        const input = ApplyVasInputSchema.parse(args || {});
        const result = await applyVas(input);
        const markdown = formatApplyVasResult(result);

        return {
          content: [{ type: 'text', text: markdown }],
          structuredContent: result,
        };
      }

      case 'avito_get_promotions': {
        const input = GetPromotionsInputSchema.parse(args || {});
        const result = await getPromotions(input);
        const markdown = formatPromotionsAsMarkdown(result.promotions);

        return {
          content: [{ type: 'text', text: markdown }],
          structuredContent: result,
        };
      }

      case 'avito_set_promotion': {
        const input = SetPromotionInputSchema.parse(args || {});
        const result = await setPromotion(input);
        const markdown = formatSetPromotionResult(result);

        return {
          content: [{ type: 'text', text: markdown }],
          structuredContent: result,
        };
      }

      // Reviews
      case 'avito_get_reviews': {
        const input = GetReviewsInputSchema.parse(args || {});
        const result = await getReviews(input);
        const markdown = formatReviewsAsMarkdown(result.reviews, result.total, result.summary);

        return {
          content: [{ type: 'text', text: markdown }],
          structuredContent: {
            total: result.total,
            summary: result.summary,
            reviews: result.reviews.slice(0, 20),
          },
        };
      }

      case 'avito_reply_review': {
        const input = ReplyReviewInputSchema.parse(args || {});
        const result = await replyReview(input);
        const markdown = formatReplyResult(result);

        return {
          content: [{ type: 'text', text: markdown }],
          structuredContent: result,
        };
      }

      // User
      case 'avito_get_user_info': {
        GetUserInfoInputSchema.parse(args || {});
        const result = await getUserInfo();
        const markdown = formatUserInfoAsMarkdown(result.user);

        return {
          content: [{ type: 'text', text: markdown }],
          structuredContent: result,
        };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      content: [{ type: 'text', text: `Error: ${message}` }],
      isError: true,
    };
  }
});

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Avito MCP Server started');
}

main().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
