#!/usr/bin/env node
/**
 * Yandex Market MCP Server
 *
 * Provides tools for managing Yandex Market Partner API:
 * - Campaigns (shops)
 * - Products
 * - Stocks
 * - Prices
 * - Orders
 * - Reviews
 * - Warehouses
 * - Quality rating
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
  GetCampaignsInputSchema,
  GetCampaignInputSchema,
  getCampaigns,
  getCampaign,
  formatCampaignsAsMarkdown,
  formatCampaignAsMarkdown,
} from './tools/campaigns.js';

import {
  GetProductsInputSchema,
  UpdateProductsInputSchema,
  getProducts,
  updateProducts,
  formatProductsAsMarkdown,
  formatUpdateProductsResult,
} from './tools/products.js';

import {
  GetStocksInputSchema,
  UpdateStocksInputSchema,
  getStocks,
  updateStocks,
  formatStocksAsMarkdown,
  formatUpdateStocksResult,
} from './tools/stocks.js';

import {
  GetPricesInputSchema,
  UpdatePricesInputSchema,
  getPrices,
  updatePrices,
  formatPricesAsMarkdown,
  formatUpdatePricesResult,
} from './tools/prices.js';

import {
  GetOrdersInputSchema,
  getOrders,
  formatOrdersAsMarkdown,
} from './tools/orders.js';

import {
  GetReviewsInputSchema,
  ReplyReviewInputSchema,
  getReviews,
  replyReview,
  formatReviewsAsMarkdown,
  formatReplyResult,
} from './tools/reviews.js';

import {
  GetWarehousesInputSchema,
  GetQualityRatingInputSchema,
  getWarehouses,
  getQualityRating,
  formatWarehousesAsMarkdown,
  formatQualityRatingAsMarkdown,
} from './tools/warehouses.js';

import {
  GetBalanceInputSchema,
  GetPaymentsInputSchema,
  getBalance,
  getPayments,
  formatBalanceAsMarkdown,
  formatPaymentsAsMarkdown,
} from './tools/finance.js';

import {
  GetCategoriesInputSchema,
  SearchCategoriesInputSchema,
  getCategories,
  searchCategories,
  formatCategoriesAsMarkdown,
  formatSearchResultsAsMarkdown,
} from './tools/categories.js';

// Create server
const server = new Server(
  {
    name: 'ym-mcp',
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
    // Categories
    {
      name: 'ym_get_categories',
      description:
        'Получить дерево категорий Яндекс.Маркет (верхний уровень). ' +
        'Для поиска конкретной категории используйте ym_search_categories.',
      inputSchema: {
        type: 'object',
        properties: {
          language: {
            type: 'string',
            enum: ['RU', 'EN'],
            description: 'Язык (по умолчанию RU)',
            default: 'RU',
          },
        },
      },
    },
    {
      name: 'ym_search_categories',
      description:
        'Поиск категории Яндекс.Маркет по названию. ' +
        'Возвращает листовые категории (без подкатегорий) с ID и путём. ' +
        'Используйте найденный ID в поле marketCategoryId при создании товара.',
      inputSchema: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Поисковый запрос (например: "браслет", "метеорит", "ювелирные")',
          },
          language: {
            type: 'string',
            enum: ['RU', 'EN'],
            description: 'Язык (по умолчанию RU)',
            default: 'RU',
          },
        },
        required: ['query'],
      },
    },

    // Campaigns
    {
      name: 'ym_get_campaigns',
      description:
        'Получить список магазинов Яндекс.Маркет. ' +
        'Возвращает campaignId, домен, статус, модель размещения (FBS/FBY/DBS).',
      inputSchema: {
        type: 'object',
        properties: {
          limit: {
            type: 'number',
            description: 'Максимальное количество магазинов (по умолчанию 50)',
            default: 50,
          },
        },
      },
    },
    {
      name: 'ym_get_campaign',
      description:
        'Получить информацию о магазине Яндекс.Маркет по ID.',
      inputSchema: {
        type: 'object',
        properties: {
          campaignId: {
            type: 'number',
            description: 'ID магазина (campaignId)',
          },
        },
        required: ['campaignId'],
      },
    },

    // Products
    {
      name: 'ym_get_products',
      description:
        'Получить список товаров в магазине Яндекс.Маркет. ' +
        'Возвращает артикулы, названия, категории, бренды, SKU.',
      inputSchema: {
        type: 'object',
        properties: {
          campaignId: {
            type: 'number',
            description: 'ID магазина (по умолчанию из env)',
          },
          limit: {
            type: 'number',
            description: 'Максимальное количество товаров (по умолчанию 100)',
            default: 100,
          },
          pageToken: {
            type: 'string',
            description: 'Токен для пагинации',
          },
          archived: {
            type: 'boolean',
            description: 'Показывать архивные товары',
            default: false,
          },
        },
      },
    },
    {
      name: 'ym_update_products',
      description:
        'Обновить карточки товаров Яндекс.Маркет (название, описание, фото, бренд, габариты). ' +
        'ВАЖНО: Без параметра confirm=true показывает preview изменений. ' +
        'С confirm=true применяет изменения.',
      inputSchema: {
        type: 'object',
        properties: {
          businessId: {
            type: 'number',
            description: 'ID кабинета (по умолчанию из env)',
          },
          products: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                offerId: { type: 'string', description: 'Артикул товара' },
                name: { type: 'string', description: 'Новое название товара' },
                description: { type: 'string', description: 'Новое описание товара' },
                vendor: { type: 'string', description: 'Бренд/производитель' },
                vendorCode: { type: 'string', description: 'Артикул производителя' },
                barcodes: { type: 'array', items: { type: 'string' }, description: 'Штрихкоды' },
                pictures: { type: 'array', items: { type: 'string' }, description: 'URL изображений' },
                manufacturer: { type: 'string', description: 'Производитель' },
                manufacturerCountries: { type: 'array', items: { type: 'string' }, description: 'Страны производства' },
                marketCategoryId: { type: 'number', description: 'ID категории ЯМ (получить через ym_search_categories)' },
                weightDimensions: {
                  type: 'object',
                  properties: {
                    length: { type: 'number', description: 'Длина в см' },
                    width: { type: 'number', description: 'Ширина в см' },
                    height: { type: 'number', description: 'Высота в см' },
                    weight: { type: 'number', description: 'Вес в кг' },
                  },
                  description: 'Габариты и вес',
                },
              },
              required: ['offerId'],
            },
            description: 'Массив товаров для обновления',
          },
          confirm: {
            type: 'boolean',
            description: 'true для применения изменений',
            default: false,
          },
        },
        required: ['products'],
      },
    },

    // Stocks
    {
      name: 'ym_get_stocks',
      description:
        'Получить остатки товаров на складах Яндекс.Маркет. ' +
        'Возвращает доступное количество, резерв, брак по складам.',
      inputSchema: {
        type: 'object',
        properties: {
          campaignId: {
            type: 'number',
            description: 'ID магазина (по умолчанию из env)',
          },
          offerIds: {
            type: 'array',
            items: { type: 'string' },
            description: 'Фильтр по артикулам',
          },
          warehouseIds: {
            type: 'array',
            items: { type: 'number' },
            description: 'Фильтр по складам',
          },
          limit: {
            type: 'number',
            description: 'Максимальное количество позиций (по умолчанию 100)',
            default: 100,
          },
          pageToken: {
            type: 'string',
            description: 'Токен для пагинации',
          },
        },
      },
    },
    {
      name: 'ym_update_stocks',
      description:
        'Обновить остатки товаров на складе Яндекс.Маркет. ' +
        'ВАЖНО: Без параметра confirm=true показывает preview изменений. ' +
        'С confirm=true применяет изменения.',
      inputSchema: {
        type: 'object',
        properties: {
          campaignId: {
            type: 'number',
            description: 'ID магазина (по умолчанию из env)',
          },
          stocks: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                sku: { type: 'string', description: 'SKU товара (артикул)' },
                warehouseId: { type: 'number', description: 'ID склада' },
                count: { type: 'number', description: 'Количество' },
              },
              required: ['sku', 'warehouseId', 'count'],
            },
            description: 'Массив обновлений остатков',
          },
          confirm: {
            type: 'boolean',
            description: 'true для применения изменений',
            default: false,
          },
        },
        required: ['stocks'],
      },
    },

    // Prices
    {
      name: 'ym_get_prices',
      description:
        'Получить цены товаров Яндекс.Маркет. ' +
        'Возвращает текущую цену, старую цену, рекомендуемую цену, цены конкурентов.',
      inputSchema: {
        type: 'object',
        properties: {
          campaignId: {
            type: 'number',
            description: 'ID магазина (по умолчанию из env)',
          },
          offerIds: {
            type: 'array',
            items: { type: 'string' },
            description: 'Фильтр по артикулам',
          },
          limit: {
            type: 'number',
            description: 'Максимальное количество товаров (по умолчанию 100)',
            default: 100,
          },
          pageToken: {
            type: 'string',
            description: 'Токен для пагинации',
          },
        },
      },
    },
    {
      name: 'ym_update_prices',
      description:
        'Установить цены на товары Яндекс.Маркет. ' +
        'ВАЖНО: Без параметра confirm=true показывает preview изменений. ' +
        'С confirm=true применяет изменения.',
      inputSchema: {
        type: 'object',
        properties: {
          campaignId: {
            type: 'number',
            description: 'ID магазина (по умолчанию из env)',
          },
          prices: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                offerId: { type: 'string', description: 'Артикул товара' },
                price: { type: 'number', description: 'Новая цена' },
                oldPrice: { type: 'number', description: 'Старая цена (зачёркнутая)' },
                discountBase: { type: 'number', description: 'Цена без скидки' },
                vat: { type: 'number', description: 'НДС: 0, 10, 20' },
              },
              required: ['offerId', 'price'],
            },
            description: 'Массив обновлений цен',
          },
          confirm: {
            type: 'boolean',
            description: 'true для применения изменений',
            default: false,
          },
        },
        required: ['prices'],
      },
    },

    // Orders
    {
      name: 'ym_get_orders',
      description:
        'Получить заказы Яндекс.Маркет. ' +
        'Возвращает список заказов с номерами, статусами, суммами и товарами.',
      inputSchema: {
        type: 'object',
        properties: {
          businessId: {
            type: 'number',
            description: 'ID кабинета (по умолчанию из env)',
          },
          dateFrom: {
            type: 'string',
            description: 'Дата начала (YYYY-MM-DD), по умолчанию 30 дней назад',
          },
          dateTo: {
            type: 'string',
            description: 'Дата конца (YYYY-MM-DD), по умолчанию сегодня',
          },
          status: {
            type: 'string',
            enum: ['CANCELLED', 'DELIVERED', 'DELIVERY', 'PICKUP', 'PROCESSING', 'PENDING', 'UNPAID', 'RESERVED'],
            description: 'Фильтр по статусу',
          },
          limit: {
            type: 'number',
            description: 'Максимальное количество заказов (по умолчанию 100)',
            default: 100,
          },
          pageToken: {
            type: 'string',
            description: 'Токен для пагинации',
          },
        },
      },
    },

    // Reviews
    {
      name: 'ym_get_reviews',
      description:
        'Получить отзывы о товарах Яндекс.Маркет. ' +
        'Возвращает отзывы с оценками, текстами, плюсами/минусами.',
      inputSchema: {
        type: 'object',
        properties: {
          businessId: {
            type: 'number',
            description: 'ID кабинета (по умолчанию из env)',
          },
          offerIds: {
            type: 'array',
            items: { type: 'string' },
            description: 'Фильтр по артикулам',
          },
          dateFrom: {
            type: 'string',
            description: 'Дата начала (YYYY-MM-DD)',
          },
          dateTo: {
            type: 'string',
            description: 'Дата конца (YYYY-MM-DD)',
          },
          rating: {
            type: 'array',
            items: { type: 'number' },
            description: 'Фильтр по оценкам (1-5)',
          },
          needReaction: {
            type: 'boolean',
            description: 'Только требующие ответа',
          },
          limit: {
            type: 'number',
            description: 'Максимальное количество отзывов (по умолчанию 50)',
            default: 50,
          },
          pageToken: {
            type: 'string',
            description: 'Токен для пагинации',
          },
        },
      },
    },
    {
      name: 'ym_reply_review',
      description:
        'Ответить на отзыв Яндекс.Маркет. ' +
        'ВАЖНО: Без параметра confirm=true показывает preview ответа. ' +
        'С confirm=true отправляет ответ.',
      inputSchema: {
        type: 'object',
        properties: {
          businessId: {
            type: 'number',
            description: 'ID кабинета (по умолчанию из env)',
          },
          feedbackId: {
            type: 'number',
            description: 'ID отзыва',
          },
          text: {
            type: 'string',
            description: 'Текст ответа (до 4000 символов)',
          },
          confirm: {
            type: 'boolean',
            description: 'true для отправки ответа',
            default: false,
          },
        },
        required: ['feedbackId', 'text'],
      },
    },

    // Warehouses
    {
      name: 'ym_get_warehouses',
      description:
        'Получить список складов Яндекс.Маркет. ' +
        'Возвращает ID, название, адрес, тип склада.',
      inputSchema: {
        type: 'object',
        properties: {
          businessId: {
            type: 'number',
            description: 'ID кабинета (по умолчанию из env)',
          },
        },
      },
    },

    // Quality
    {
      name: 'ym_get_quality_rating',
      description:
        'Получить индекс качества магазина Яндекс.Маркет. ' +
        'Возвращает общий рейтинг и компоненты (отмены, опоздания, возвраты).',
      inputSchema: {
        type: 'object',
        properties: {
          businessId: {
            type: 'number',
            description: 'ID кабинета (по умолчанию из env)',
          },
          campaignIds: {
            type: 'array',
            items: { type: 'number' },
            description: 'Фильтр по ID магазинов',
          },
        },
      },
    },

    // Finance
    {
      name: 'ym_get_balance',
      description:
        'Получить текущий баланс продавца Яндекс.Маркет. ' +
        'Возвращает баланс, валюту и дату обновления.',
      inputSchema: {
        type: 'object',
        properties: {
          campaignId: {
            type: 'number',
            description: 'ID магазина (по умолчанию из env)',
          },
        },
      },
    },
    {
      name: 'ym_get_payments',
      description:
        'Получить историю выплат Яндекс.Маркет. ' +
        'Возвращает операции с суммами и сводку по типам.',
      inputSchema: {
        type: 'object',
        properties: {
          campaignId: {
            type: 'number',
            description: 'ID магазина (по умолчанию из env)',
          },
          dateFrom: {
            type: 'string',
            description: 'Дата начала (YYYY-MM-DD)',
          },
          dateTo: {
            type: 'string',
            description: 'Дата конца (YYYY-MM-DD), по умолчанию сегодня',
          },
          limit: {
            type: 'number',
            description: 'Максимальное количество записей',
            default: 100,
          },
          pageToken: {
            type: 'string',
            description: 'Токен для пагинации',
          },
        },
        required: ['dateFrom'],
      },
    },
  ],
}));

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      // Categories
      case 'ym_get_categories': {
        const input = GetCategoriesInputSchema.parse(args || {});
        const result = await getCategories(input);
        const markdown = formatCategoriesAsMarkdown(result.categories);

        return {
          content: [{ type: 'text', text: markdown }],
          structuredContent: {
            total: result.total,
            categories: result.categories.slice(0, 30),
          },
        };
      }

      case 'ym_search_categories': {
        const input = SearchCategoriesInputSchema.parse(args || {});
        const result = await searchCategories(input);
        const markdown = formatSearchResultsAsMarkdown(result.categories, input.query);

        return {
          content: [{ type: 'text', text: markdown }],
          structuredContent: {
            total: result.total,
            categories: result.categories,
          },
        };
      }

      // Campaigns
      case 'ym_get_campaigns': {
        const input = GetCampaignsInputSchema.parse(args || {});
        const result = await getCampaigns(input);
        const markdown = formatCampaignsAsMarkdown(result.campaigns);

        return {
          content: [{ type: 'text', text: markdown }],
          structuredContent: {
            total: result.total,
            campaigns: result.campaigns,
          },
        };
      }

      case 'ym_get_campaign': {
        const input = GetCampaignInputSchema.parse(args || {});
        const result = await getCampaign(input);
        const markdown = formatCampaignAsMarkdown(result.campaign);

        return {
          content: [{ type: 'text', text: markdown }],
          structuredContent: result,
        };
      }

      // Products
      case 'ym_get_products': {
        const input = GetProductsInputSchema.parse(args || {});
        const result = await getProducts(input);
        const markdown = formatProductsAsMarkdown(result.products, result.nextPageToken);

        return {
          content: [{ type: 'text', text: markdown }],
          structuredContent: {
            total: result.total,
            nextPageToken: result.nextPageToken,
            products: result.products.slice(0, 30),
          },
        };
      }

      case 'ym_update_products': {
        const input = UpdateProductsInputSchema.parse(args || {});
        const result = await updateProducts(input);
        const markdown = formatUpdateProductsResult(result);

        return {
          content: [{ type: 'text', text: markdown }],
          structuredContent: result,
        };
      }

      // Stocks
      case 'ym_get_stocks': {
        const input = GetStocksInputSchema.parse(args || {});
        const result = await getStocks(input);
        const markdown = formatStocksAsMarkdown(result.stocks, result.nextPageToken);

        return {
          content: [{ type: 'text', text: markdown }],
          structuredContent: {
            total: result.total,
            nextPageToken: result.nextPageToken,
            stocks: result.stocks.slice(0, 30),
          },
        };
      }

      case 'ym_update_stocks': {
        const input = UpdateStocksInputSchema.parse(args || {});
        const result = await updateStocks(input);
        const markdown = formatUpdateStocksResult(result);

        return {
          content: [{ type: 'text', text: markdown }],
          structuredContent: result,
        };
      }

      // Prices
      case 'ym_get_prices': {
        const input = GetPricesInputSchema.parse(args || {});
        const result = await getPrices(input);
        const markdown = formatPricesAsMarkdown(result.prices, result.nextPageToken);

        return {
          content: [{ type: 'text', text: markdown }],
          structuredContent: {
            total: result.total,
            nextPageToken: result.nextPageToken,
            prices: result.prices.slice(0, 30),
          },
        };
      }

      case 'ym_update_prices': {
        const input = UpdatePricesInputSchema.parse(args || {});
        const result = await updatePrices(input);
        const markdown = formatUpdatePricesResult(result);

        return {
          content: [{ type: 'text', text: markdown }],
          structuredContent: result,
        };
      }

      // Orders
      case 'ym_get_orders': {
        const input = GetOrdersInputSchema.parse(args || {});
        const result = await getOrders(input);
        const markdown = formatOrdersAsMarkdown(result.orders, result.summary, result.nextPageToken);

        return {
          content: [{ type: 'text', text: markdown }],
          structuredContent: {
            total: result.summary.total,
            summary: result.summary,
            nextPageToken: result.nextPageToken,
            orders: result.orders.slice(0, 30),
          },
        };
      }

      // Reviews
      case 'ym_get_reviews': {
        const input = GetReviewsInputSchema.parse(args || {});
        const result = await getReviews(input);
        const markdown = formatReviewsAsMarkdown(result.reviews, result.summary, result.nextPageToken);

        return {
          content: [{ type: 'text', text: markdown }],
          structuredContent: {
            total: result.summary.total,
            summary: result.summary,
            nextPageToken: result.nextPageToken,
            reviews: result.reviews.slice(0, 20),
          },
        };
      }

      case 'ym_reply_review': {
        const input = ReplyReviewInputSchema.parse(args || {});
        const result = await replyReview(input);
        const markdown = formatReplyResult(result);

        return {
          content: [{ type: 'text', text: markdown }],
          structuredContent: result,
        };
      }

      // Warehouses
      case 'ym_get_warehouses': {
        const input = GetWarehousesInputSchema.parse(args || {});
        const result = await getWarehouses(input);
        const markdown = formatWarehousesAsMarkdown(result.warehouses);

        return {
          content: [{ type: 'text', text: markdown }],
          structuredContent: result,
        };
      }

      // Quality
      case 'ym_get_quality_rating': {
        const input = GetQualityRatingInputSchema.parse(args || {});
        const result = await getQualityRating(input);
        const markdown = formatQualityRatingAsMarkdown(result.ratings);

        return {
          content: [{ type: 'text', text: markdown }],
          structuredContent: result,
        };
      }

      // Finance
      case 'ym_get_balance': {
        const input = GetBalanceInputSchema.parse(args || {});
        const result = await getBalance(input);
        const markdown = formatBalanceAsMarkdown(result.balance);

        return {
          content: [{ type: 'text', text: markdown }],
          structuredContent: result,
        };
      }

      case 'ym_get_payments': {
        const input = GetPaymentsInputSchema.parse(args || {});
        const result = await getPayments(input);
        const markdown = formatPaymentsAsMarkdown(result.payments, result.summary);

        return {
          content: [{ type: 'text', text: markdown }],
          structuredContent: {
            summary: result.summary,
            payments: result.payments.slice(0, 30),
          },
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
  console.error('Yandex Market MCP Server started');
}

main().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
