#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

import { closePool } from './db/postgres.js';
import {
  GetProductsInputSchema,
  GetProductInfoInputSchema,
  UpdateProductInputSchema,
  getProducts,
  getProductInfoList,
  updateProduct,
  formatProductsAsMarkdown,
  formatProductInfoAsMarkdown,
  formatUpdateProductResult,
} from './tools/products.js';
import {
  GetPricesInputSchema,
  UpdatePriceInputSchema,
  getPrices,
  updatePrice,
  formatPricesAsMarkdown,
  formatUpdateResult,
} from './tools/prices.js';
import {
  GetStocksInputSchema,
  UpdateStocksInputSchema,
  getStocks,
  updateStocks,
  formatStocksAsMarkdown,
  formatUpdateStocksResult,
} from './tools/stocks.js';
import {
  ImportProductsInputSchema,
  GetCategoriesInputSchema,
  GetCategoryAttributesInputSchema,
  GetImportStatusInputSchema,
  importProducts,
  getCategories,
  getCategoryAttributes,
  getImportStatus,
  formatImportResultAsMarkdown,
  formatCategoriesAsMarkdown,
  formatAttributesAsMarkdown,
  formatImportStatusAsMarkdown,
} from './tools/import.js';
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
  formatReplyResultAsMarkdown,
} from './tools/reviews.js';
import {
  GetBalanceInputSchema,
  GetTransactionsInputSchema,
  getBalance,
  getTransactions,
  formatBalanceAsMarkdown,
  formatTransactionsAsMarkdown,
} from './tools/finance.js';

// Create server
const server = new Server(
  {
    name: 'ozon-mcp',
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
    {
      name: 'ozon_get_products',
      description:
        'Получить список товаров Ozon. ' +
        'Возвращает product_id, offer_id (артикул), видимость FBO/FBS, статус архивации.',
      inputSchema: {
        type: 'object',
        properties: {
          offerIds: {
            type: 'array',
            items: { type: 'string' },
            description: 'Фильтр по артикулам продавца (offer_id)',
          },
          productIds: {
            type: 'array',
            items: { type: 'number' },
            description: 'Фильтр по product_id Ozon',
          },
          visibility: {
            type: 'string',
            enum: ['ALL', 'VISIBLE', 'INVISIBLE', 'EMPTY_STOCK', 'NOT_MODERATED', 'MODERATED', 'DISABLED', 'ARCHIVED'],
            description: 'Фильтр по видимости товара',
            default: 'ALL',
          },
          limit: {
            type: 'number',
            description: 'Максимальное количество товаров (по умолчанию 100)',
            default: 100,
          },
          useCache: {
            type: 'boolean',
            description: 'Использовать кэш если доступен',
            default: true,
          },
          cacheTTL: {
            type: 'number',
            description: 'Время жизни кэша в минутах',
            default: 15,
          },
        },
      },
    },
    {
      name: 'ozon_get_product_info',
      description:
        'Получить детальную информацию о товарах Ozon. ' +
        'Возвращает название, статус, модерацию, видимость, остатки, ошибки, SKU. ' +
        'Используйте когда нужна полная информация о товаре.',
      inputSchema: {
        type: 'object',
        properties: {
          offerIds: {
            type: 'array',
            items: { type: 'string' },
            description: 'Фильтр по артикулам продавца (offer_id)',
          },
          productIds: {
            type: 'array',
            items: { type: 'number' },
            description: 'Фильтр по product_id Ozon',
          },
          skus: {
            type: 'array',
            items: { type: 'number' },
            description: 'Фильтр по SKU Ozon',
          },
        },
      },
    },
    {
      name: 'ozon_get_prices',
      description:
        'Получить цены товаров Ozon. ' +
        'Возвращает цену, старую цену (зачёркнутую), Premium цену, комиссии.',
      inputSchema: {
        type: 'object',
        properties: {
          offerIds: {
            type: 'array',
            items: { type: 'string' },
            description: 'Фильтр по артикулам продавца (offer_id)',
          },
          productIds: {
            type: 'array',
            items: { type: 'number' },
            description: 'Фильтр по product_id Ozon',
          },
          visibility: {
            type: 'string',
            enum: ['ALL', 'VISIBLE', 'INVISIBLE', 'EMPTY_STOCK', 'NOT_MODERATED', 'MODERATED'],
            description: 'Фильтр по видимости товара',
            default: 'ALL',
          },
          limit: {
            type: 'number',
            description: 'Максимальное количество товаров (по умолчанию 100)',
            default: 100,
          },
        },
      },
    },
    {
      name: 'ozon_update_price',
      description:
        'Изменить цену товара Ozon. ' +
        'ВАЖНО: Без параметра confirm=true показывает preview изменений (БЫЛО → СТАЛО). ' +
        'С confirm=true применяет изменения.',
      inputSchema: {
        type: 'object',
        properties: {
          offerId: {
            type: 'string',
            description: 'Артикул продавца (offer_id)',
          },
          price: {
            type: 'string',
            description: 'Новая цена (строка, например "1500")',
          },
          oldPrice: {
            type: 'string',
            description: 'Старая цена (зачёркнутая, для показа скидки)',
          },
          premiumPrice: {
            type: 'string',
            description: 'Цена для Premium пользователей',
          },
          vat: {
            type: 'string',
            enum: ['0', '0.1', '0.2'],
            description: 'Ставка НДС: 0 (без НДС), 0.1 (10%), 0.2 (20%)',
            default: '0.2',
          },
          confirm: {
            type: 'boolean',
            description: 'true для подтверждения и применения изменений',
            default: false,
          },
        },
        required: ['offerId'],
      },
    },
    {
      name: 'ozon_get_stocks',
      description:
        'Получить остатки товаров Ozon. ' +
        'Возвращает остатки на складах FBO и FBS (доступно, зарезервировано).',
      inputSchema: {
        type: 'object',
        properties: {
          offerIds: {
            type: 'array',
            items: { type: 'string' },
            description: 'Фильтр по артикулам продавца (offer_id)',
          },
          productIds: {
            type: 'array',
            items: { type: 'number' },
            description: 'Фильтр по product_id Ozon',
          },
          visibility: {
            type: 'string',
            enum: ['ALL', 'VISIBLE', 'INVISIBLE', 'EMPTY_STOCK', 'NOT_MODERATED', 'MODERATED'],
            description: 'Фильтр по видимости товара',
            default: 'ALL',
          },
          limit: {
            type: 'number',
            description: 'Максимальное количество товаров (по умолчанию 100)',
            default: 100,
          },
        },
      },
    },
    {
      name: 'ozon_update_stocks',
      description:
        'Обновить остатки товаров на складах Ozon (FBS). ' +
        'ВАЖНО: Без параметра confirm=true показывает preview изменений. ' +
        'С confirm=true применяет изменения.',
      inputSchema: {
        type: 'object',
        properties: {
          stocks: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                offerId: {
                  type: 'string',
                  description: 'Артикул продавца (offer_id)',
                },
                warehouseId: {
                  type: 'number',
                  description: 'ID склада',
                },
                stock: {
                  type: 'number',
                  description: 'Новое количество',
                },
              },
              required: ['offerId', 'warehouseId', 'stock'],
            },
            description: 'Массив обновлений остатков',
          },
          confirm: {
            type: 'boolean',
            description: 'true для подтверждения и применения изменений',
            default: false,
          },
        },
        required: ['stocks'],
      },
    },
    {
      name: 'ozon_import_products',
      description:
        'Импортировать товары на Ozon. ' +
        'ВАЖНО: Без параметра confirm=true показывает preview. ' +
        'С confirm=true запускает импорт. Используйте ozon_get_import_status для проверки статуса.',
      inputSchema: {
        type: 'object',
        properties: {
          products: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                offerId: { type: 'string', description: 'Артикул продавца (должен быть уникальным)' },
                name: { type: 'string', description: 'Название товара' },
                price: { type: 'string', description: 'Цена товара' },
                oldPrice: { type: 'string', description: 'Старая цена (для показа скидки)' },
                vat: { type: 'string', enum: ['0', '0.1', '0.2'], description: 'Ставка НДС' },
                descriptionCategoryId: { type: 'number', description: 'ID категории Ozon' },
                images: { type: 'array', items: { type: 'string' }, description: 'URL изображений' },
                barcode: { type: 'string', description: 'Штрихкод' },
                weight: { type: 'number', description: 'Вес в граммах' },
                depth: { type: 'number', description: 'Глубина в мм' },
                height: { type: 'number', description: 'Высота в мм' },
                width: { type: 'number', description: 'Ширина в мм' },
                attributes: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      id: { type: 'number', description: 'ID атрибута' },
                      value: { type: 'string', description: 'Значение атрибута' },
                      dictionaryValueId: { type: 'number', description: 'ID из словаря' },
                    },
                  },
                  description: 'Атрибуты товара',
                },
              },
              required: ['offerId', 'name', 'price', 'descriptionCategoryId'],
            },
            description: 'Массив товаров для импорта',
          },
          confirm: {
            type: 'boolean',
            description: 'true для запуска импорта, false для preview',
            default: false,
          },
        },
        required: ['products'],
      },
    },
    {
      name: 'ozon_get_categories',
      description:
        'Получить дерево категорий Ozon. ' +
        'Используйте для поиска ID категории перед импортом товаров.',
      inputSchema: {
        type: 'object',
        properties: {
          parentId: {
            type: 'number',
            description: 'ID родительской категории (0 для корневых)',
            default: 0,
          },
          language: {
            type: 'string',
            enum: ['RU', 'EN'],
            description: 'Язык',
            default: 'RU',
          },
        },
      },
    },
    {
      name: 'ozon_get_category_attributes',
      description:
        'Получить атрибуты категории Ozon. ' +
        'Показывает обязательные и опциональные атрибуты для заполнения карточки товара.',
      inputSchema: {
        type: 'object',
        properties: {
          categoryId: {
            type: 'number',
            description: 'ID категории',
          },
          typeId: {
            type: 'number',
            description: 'ID типа товара (по умолчанию 0)',
            default: 0,
          },
          language: {
            type: 'string',
            enum: ['RU', 'EN'],
            description: 'Язык',
            default: 'RU',
          },
        },
        required: ['categoryId'],
      },
    },
    {
      name: 'ozon_get_import_status',
      description:
        'Получить статус импорта товаров на Ozon. ' +
        'Используйте после ozon_import_products для проверки результата.',
      inputSchema: {
        type: 'object',
        properties: {
          taskId: {
            type: 'number',
            description: 'ID задачи импорта',
          },
        },
        required: ['taskId'],
      },
    },
    {
      name: 'ozon_get_orders',
      description:
        'Получить заказы Ozon (FBO и FBS). ' +
        'Возвращает список заказов с номерами, статусами, суммами и товарами.',
      inputSchema: {
        type: 'object',
        properties: {
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
            enum: ['awaiting_approve', 'awaiting_packaging', 'awaiting_deliver', 'delivering', 'delivered', 'cancelled', 'all'],
            description: 'Фильтр по статусу заказа',
            default: 'all',
          },
          limit: {
            type: 'number',
            description: 'Максимальное количество заказов (по умолчанию 100)',
            default: 100,
          },
        },
      },
    },
    {
      name: 'ozon_get_reviews',
      description:
        'Получить отзывы на товары Ozon. ' +
        'Возвращает список отзывов с оценками, текстами, плюсами/минусами и ответами продавца.',
      inputSchema: {
        type: 'object',
        properties: {
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
            enum: ['all', 'processed', 'unprocessed'],
            description: 'Фильтр по статусу обработки (all=все, processed=с ответом, unprocessed=без ответа)',
            default: 'all',
          },
          rating: {
            type: 'array',
            items: { type: 'number' },
            description: 'Фильтр по оценкам (1-5)',
          },
          productIds: {
            type: 'array',
            items: { type: 'number' },
            description: 'Фильтр по product_id товаров',
          },
          skus: {
            type: 'array',
            items: { type: 'number' },
            description: 'Фильтр по SKU товаров',
          },
          limit: {
            type: 'number',
            description: 'Максимальное количество отзывов (по умолчанию 50)',
            default: 50,
          },
        },
      },
    },
    {
      name: 'ozon_reply_review',
      description:
        'Ответить на отзыв Ozon. ' +
        'ВАЖНО: Без параметра confirm=true показывает preview ответа. ' +
        'С confirm=true отправляет ответ.',
      inputSchema: {
        type: 'object',
        properties: {
          reviewId: {
            type: 'number',
            description: 'ID отзыва для ответа',
          },
          text: {
            type: 'string',
            description: 'Текст ответа (до 1000 символов)',
          },
          confirm: {
            type: 'boolean',
            description: 'true для отправки ответа, false для preview',
            default: false,
          },
        },
        required: ['reviewId', 'text'],
      },
    },
    {
      name: 'ozon_update_product',
      description:
        'Обновить карточку товара Ozon (название, описание, изображения, атрибуты). ' +
        'ВАЖНО: Без параметра confirm=true показывает preview изменений. ' +
        'С confirm=true отправляет на модерацию. Используйте ozon_get_import_status для проверки статуса.',
      inputSchema: {
        type: 'object',
        properties: {
          offerId: {
            type: 'string',
            description: 'Артикул продавца (offer_id) товара для обновления',
          },
          name: {
            type: 'string',
            description: 'Новое название товара',
          },
          description: {
            type: 'string',
            description: 'Новое описание товара',
          },
          images: {
            type: 'array',
            items: { type: 'string' },
            description: 'Новые URL изображений товара',
          },
          attributes: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'number', description: 'ID атрибута' },
                value: { type: 'string', description: 'Значение атрибута' },
                dictionaryValueId: { type: 'number', description: 'ID значения из словаря' },
              },
            },
            description: 'Атрибуты для обновления',
          },
          confirm: {
            type: 'boolean',
            description: 'true для отправки изменений, false для preview',
            default: false,
          },
        },
        required: ['offerId'],
      },
    },
    {
      name: 'ozon_get_balance',
      description:
        'Получить текущий баланс продавца Ozon. ' +
        'Возвращает баланс, валюту и дату обновления.',
      inputSchema: {
        type: 'object',
        properties: {},
      },
    },
    {
      name: 'ozon_get_transactions',
      description:
        'Получить список транзакций Ozon. ' +
        'Возвращает операции с начислениями, комиссиями и сводку по типам.',
      inputSchema: {
        type: 'object',
        properties: {
          dateFrom: {
            type: 'string',
            description: 'Дата начала (YYYY-MM-DDTHH:mm:ss.000Z или YYYY-MM-DD)',
          },
          dateTo: {
            type: 'string',
            description: 'Дата конца, по умолчанию сегодня',
          },
          transactionType: {
            type: 'string',
            enum: ['all', 'orders', 'returns', 'services', 'deposit', 'other'],
            description: 'Тип транзакций',
            default: 'all',
          },
          page: {
            type: 'number',
            description: 'Номер страницы',
            default: 1,
          },
          pageSize: {
            type: 'number',
            description: 'Записей на странице (макс 1000)',
            default: 100,
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
      case 'ozon_get_products': {
        const input = GetProductsInputSchema.parse(args || {});
        const result = await getProducts(input);
        const markdown = formatProductsAsMarkdown(result.products);

        return {
          content: [
            {
              type: 'text',
              text: markdown,
            },
          ],
          structuredContent: {
            total: result.total,
            source: result.source,
            syncedAt: result.syncedAt,
            products: result.products.slice(0, 20),
          },
        };
      }

      case 'ozon_get_product_info': {
        const input = GetProductInfoInputSchema.parse(args || {});
        const result = await getProductInfoList(input);
        const markdown = formatProductInfoAsMarkdown(result.products);

        return {
          content: [
            {
              type: 'text',
              text: markdown,
            },
          ],
          structuredContent: {
            total: result.total,
            products: result.products,
          },
        };
      }

      case 'ozon_get_prices': {
        const input = GetPricesInputSchema.parse(args || {});
        const result = await getPrices(input);
        const markdown = formatPricesAsMarkdown(result.products);

        return {
          content: [
            {
              type: 'text',
              text: markdown,
            },
          ],
          structuredContent: {
            total: result.total,
            products: result.products.slice(0, 20),
          },
        };
      }

      case 'ozon_update_price': {
        const input = UpdatePriceInputSchema.parse(args || {});
        const result = await updatePrice(input);
        const markdown = formatUpdateResult(result);

        return {
          content: [
            {
              type: 'text',
              text: markdown,
            },
          ],
          structuredContent: result,
        };
      }

      case 'ozon_get_stocks': {
        const input = GetStocksInputSchema.parse(args || {});
        const result = await getStocks(input);
        const markdown = formatStocksAsMarkdown(result.products);

        return {
          content: [
            {
              type: 'text',
              text: markdown,
            },
          ],
          structuredContent: {
            total: result.total,
            products: result.products.slice(0, 20),
          },
        };
      }

      case 'ozon_update_stocks': {
        const input = UpdateStocksInputSchema.parse(args || {});
        const result = await updateStocks(input);
        const markdown = formatUpdateStocksResult(result);

        return {
          content: [
            {
              type: 'text',
              text: markdown,
            },
          ],
          structuredContent: result,
        };
      }

      case 'ozon_import_products': {
        const input = ImportProductsInputSchema.parse(args || {});
        const result = await importProducts(input);
        const markdown = formatImportResultAsMarkdown(result);

        return {
          content: [
            {
              type: 'text',
              text: markdown,
            },
          ],
          structuredContent: result,
        };
      }

      case 'ozon_get_categories': {
        const input = GetCategoriesInputSchema.parse(args || {});
        const result = await getCategories(input);
        const markdown = formatCategoriesAsMarkdown(result.categories);

        return {
          content: [
            {
              type: 'text',
              text: markdown,
            },
          ],
          structuredContent: result,
        };
      }

      case 'ozon_get_category_attributes': {
        const input = GetCategoryAttributesInputSchema.parse(args || {});
        const result = await getCategoryAttributes(input);
        const markdown = formatAttributesAsMarkdown(result.attributes);

        return {
          content: [
            {
              type: 'text',
              text: markdown,
            },
          ],
          structuredContent: result,
        };
      }

      case 'ozon_get_import_status': {
        const input = GetImportStatusInputSchema.parse(args || {});
        const result = await getImportStatus(input);
        const markdown = formatImportStatusAsMarkdown(result);

        return {
          content: [
            {
              type: 'text',
              text: markdown,
            },
          ],
          structuredContent: result,
        };
      }

      case 'ozon_get_orders': {
        const input = GetOrdersInputSchema.parse(args || {});
        const result = await getOrders(input);
        const markdown = formatOrdersAsMarkdown(result.orders, result.summary);

        return {
          content: [
            {
              type: 'text',
              text: markdown,
            },
          ],
          structuredContent: {
            total: result.total,
            summary: result.summary,
            orders: result.orders.slice(0, 30),
          },
        };
      }

      case 'ozon_get_reviews': {
        const input = GetReviewsInputSchema.parse(args || {});
        const result = await getReviews(input);
        const markdown = formatReviewsAsMarkdown(result.reviews, result.summary);

        return {
          content: [
            {
              type: 'text',
              text: markdown,
            },
          ],
          structuredContent: {
            total: result.total,
            summary: result.summary,
            reviews: result.reviews.slice(0, 20),
          },
        };
      }

      case 'ozon_reply_review': {
        const input = ReplyReviewInputSchema.parse(args || {});
        const result = await replyReview(input);
        const markdown = formatReplyResultAsMarkdown(result);

        return {
          content: [
            {
              type: 'text',
              text: markdown,
            },
          ],
          structuredContent: result,
        };
      }

      case 'ozon_update_product': {
        const input = UpdateProductInputSchema.parse(args || {});
        const result = await updateProduct(input);
        const markdown = formatUpdateProductResult(result);

        return {
          content: [
            {
              type: 'text',
              text: markdown,
            },
          ],
          structuredContent: result,
        };
      }

      case 'ozon_get_balance': {
        const input = GetBalanceInputSchema.parse(args || {});
        const result = await getBalance(input);
        const markdown = formatBalanceAsMarkdown(result.balance);

        return {
          content: [
            {
              type: 'text',
              text: markdown,
            },
          ],
          structuredContent: result,
        };
      }

      case 'ozon_get_transactions': {
        const input = GetTransactionsInputSchema.parse(args || {});
        const result = await getTransactions(input);
        const markdown = formatTransactionsAsMarkdown(result.transactions, result.summary);

        return {
          content: [
            {
              type: 'text',
              text: markdown,
            },
          ],
          structuredContent: {
            summary: result.summary,
            transactions: result.transactions.slice(0, 30),
          },
        };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      content: [
        {
          type: 'text',
          text: `Error: ${message}`,
        },
      ],
      isError: true,
    };
  }
});

// Handle shutdown
process.on('SIGINT', async () => {
  await closePool();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await closePool();
  process.exit(0);
});

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Ozon MCP Server started');
}

main().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
