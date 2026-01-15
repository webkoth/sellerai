import { z } from 'zod';
import { createOzonHeaders, OZON_API_URL } from '../utils/auth.js';
import { cacheProduct, getAllCachedProducts } from '../db/postgres.js';
import { logRead, logWriteWithPreview, logWriteConfirmed } from '../utils/logger.js';

// Input schema for ozon_get_products
export const GetProductsInputSchema = z.object({
  offerIds: z.array(z.string()).optional().describe('Filter by seller offer_ids (SKUs)'),
  productIds: z.array(z.number()).optional().describe('Filter by Ozon product_ids'),
  visibility: z
    .enum(['ALL', 'VISIBLE', 'INVISIBLE', 'EMPTY_STOCK', 'NOT_MODERATED', 'MODERATED', 'DISABLED', 'STATE_FAILED', 'READY_TO_SUPPLY', 'VALIDATION_STATE_PENDING', 'VALIDATION_STATE_FAIL', 'VALIDATION_STATE_SUCCESS', 'TO_SUPPLY', 'IN_SALE', 'REMOVED_FROM_SALE', 'BANNED', 'OVERPRICED', 'CRITICALLY_OVERPRICED', 'EMPTY_BARCODE', 'BARCODE_EXISTS', 'QUARANTINE', 'ARCHIVED', 'OVERPRICED_WITH_STOCK', 'PARTIAL_APPROVED'])
    .optional()
    .default('ALL')
    .describe('Product visibility filter'),
  limit: z.number().optional().default(100).describe('Maximum number of products to return'),
  useCache: z.boolean().optional().default(true).describe('Use cached data if available'),
  cacheTTL: z.number().optional().default(15).describe('Cache TTL in minutes'),
});

export type GetProductsInput = z.infer<typeof GetProductsInputSchema>;

// Input schema for ozon_get_product_info
export const GetProductInfoInputSchema = z.object({
  offerIds: z.array(z.string()).optional().describe('Filter by seller offer_ids (SKUs)'),
  productIds: z.array(z.number()).optional().describe('Filter by Ozon product_ids'),
  skus: z.array(z.number()).optional().describe('Filter by Ozon SKUs'),
});

export type GetProductInfoInput = z.infer<typeof GetProductInfoInputSchema>;

// Input schema for ozon_update_product
export const UpdateProductInputSchema = z.object({
  offerId: z.string().describe('Product offer_id to update'),
  name: z.string().optional().describe('New product name'),
  description: z.string().optional().describe('New product description'),
  images: z.array(z.string()).optional().describe('New product images URLs'),
  attributes: z.array(z.object({
    id: z.number().describe('Attribute ID'),
    value: z.string().optional().describe('Attribute value'),
    dictionaryValueId: z.number().optional().describe('Dictionary value ID'),
  })).optional().describe('Product attributes to update'),
  confirm: z.boolean().optional().default(false).describe('Set to true to apply changes'),
});

export type UpdateProductInput = z.infer<typeof UpdateProductInputSchema>;

// Product interface
interface OzonProduct {
  productId: number;
  offerId: string;
  name: string;
  barcode?: string;
  categoryId?: number;
  createdAt?: string;
  images?: string[];
  isFboVisible?: boolean;
  isFbsVisible?: boolean;
  archived?: boolean;
  isDiscounted?: boolean;
}

// Detailed product info interface
interface OzonProductInfo {
  id: number;
  offerId: string;
  name: string;
  barcode: string;
  barcodes: string[];
  buyboxPrice: string;
  descriptionCategoryId: number;
  typeId: number;
  createdAt: string;
  images: string[];
  primaryImage: string;
  status: {
    state: string;
    stateFailed: string;
    moderateStatus: string;
    declineReasons: string[];
    validationState: string;
    stateName: string;
    stateDescription: string;
    stateTooltip: string;
    itemErrors: Array<{ code: string; state: string; level: string; description: string; field: string; attributeId: number; attributeName: string }>;
    stateUpdatedAt: string;
  };
  sources: Array<{ source: string; sku: number }>;
  stocks: {
    coming: number;
    present: number;
    reserved: number;
  };
  errors: string[];
  updatedAt: string;
  vat: string;
  visible: boolean;
  visibilityDetails: {
    hasPrice: boolean;
    hasStock: boolean;
    activeProduct: boolean;
    reasons: Record<string, unknown>;
  };
  priceIndexes: {
    priceIndex: string;
    externalIndexData: {
      minimalPrice: string;
      minimalPriceCurrency: string;
      priceIndexValue: number;
    };
    ozonIndexData: {
      minimalPrice: string;
      minimalPriceCurrency: string;
      priceIndexValue: number;
    };
    selfMarketplacesIndexData: {
      minimalPrice: string;
      minimalPriceCurrency: string;
      priceIndexValue: number;
    };
  };
  isKgt: boolean;
  colorImage: string;
  lastId: string;
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
 * Get product list from Ozon API
 * POST /v3/product/list
 */
async function getProductList(input: GetProductsInput): Promise<OzonProduct[]> {
  const products: OzonProduct[] = [];
  let lastId = '';

  while (products.length < input.limit) {
    const body: Record<string, unknown> = {
      filter: {
        visibility: input.visibility || 'ALL',
      },
      limit: Math.min(100, input.limit - products.length),
      last_id: lastId || undefined,
    };

    // Add offer_id filter if specified
    if (input.offerIds && input.offerIds.length > 0) {
      (body.filter as Record<string, unknown>).offer_id = input.offerIds;
    }

    // Add product_id filter if specified
    if (input.productIds && input.productIds.length > 0) {
      (body.filter as Record<string, unknown>).product_id = input.productIds;
    }

    const result = await fetchOzon<{
      result: {
        items: Array<{
          product_id: number;
          offer_id: string;
          is_fbo_visible: boolean;
          is_fbs_visible: boolean;
          archived: boolean;
          is_discounted: boolean;
        }>;
        total: number;
        last_id: string;
      };
    }>('/v3/product/list', body);

    const items = result.result?.items || [];
    if (items.length === 0) break;

    for (const item of items) {
      products.push({
        productId: item.product_id,
        offerId: item.offer_id,
        name: '', // Will be enriched from product/info
        isFboVisible: item.is_fbo_visible,
        isFbsVisible: item.is_fbs_visible,
        archived: item.archived,
        isDiscounted: item.is_discounted,
      });
    }

    lastId = result.result.last_id;
    if (!lastId || items.length < 100) break;
  }

  return products;
}

/**
 * Get detailed product info
 * POST /v2/product/info
 * @internal Reserved for future use - enriching product data
 */
async function _getProductInfo(offerId: string): Promise<OzonProduct | null> {
  const result = await fetchOzon<{
    result: {
      id: number;
      offer_id: string;
      name: string;
      barcode: string;
      category_id: number;
      created_at: string;
      images: string[];
      primary_image: string;
    };
  }>('/v2/product/info', {
    offer_id: offerId,
    sku: 0,
    product_id: 0,
  });

  if (result.result) {
    const item = result.result;
    return {
      productId: item.id,
      offerId: item.offer_id,
      name: item.name,
      barcode: item.barcode,
      categoryId: item.category_id,
      createdAt: item.created_at,
      images: item.images,
    };
  }

  return null;
}

// Export for potential future use
export { _getProductInfo as getProductInfo };

/**
 * Main products tool handler
 */
export async function getProducts(input: GetProductsInput): Promise<{
  products: OzonProduct[];
  total: number;
  source: 'cache' | 'api';
  syncedAt: string;
}> {
  const { useCache, cacheTTL } = input;

  // Try cache first
  if (useCache) {
    const cached = await getAllCachedProducts('ozon', cacheTTL);
    if (cached.length > 0) {
      const products = cached.map((p) => ({
        productId: parseInt(p.nm_id as string),
        offerId: (p.sku as string) || '',
        name: (p.name as string) || '',
        barcode: p.barcode as string,
        isFboVisible: true,
        isFbsVisible: true,
        archived: false,
        isDiscounted: false,
      }));

      await logRead('ozon_get_products', 'products', input, { count: products.length, source: 'cache' });

      return {
        products,
        total: products.length,
        source: 'cache',
        syncedAt: new Date().toISOString(),
      };
    }
  }

  // Fetch from API
  const products = await getProductList(input);

  // Cache products
  for (const product of products) {
    await cacheProduct({
      marketplace: 'ozon',
      productId: product.productId.toString(),
      offerId: product.offerId,
      name: product.name,
      barcode: product.barcode,
      rawData: product as unknown as Record<string, unknown>,
    });
  }

  await logRead('ozon_get_products', 'products', input, { count: products.length, source: 'api' });

  return {
    products,
    total: products.length,
    source: 'api',
    syncedAt: new Date().toISOString(),
  };
}

/**
 * Format products as markdown table
 */
export function formatProductsAsMarkdown(products: OzonProduct[]): string {
  if (products.length === 0) {
    return 'Товары не найдены';
  }

  const lines = [
    '| Product ID | Артикул (offer_id) | Название | FBO | FBS | Архив |',
    '|------------|-------------------|----------|-----|-----|-------|',
  ];

  for (const p of products.slice(0, 50)) {
    const name = (p.name || '').substring(0, 30) || '-';
    const fbo = p.isFboVisible ? '✅' : '❌';
    const fbs = p.isFbsVisible ? '✅' : '❌';
    const archived = p.archived ? '📦' : '-';
    lines.push(`| ${p.productId} | ${p.offerId} | ${name} | ${fbo} | ${fbs} | ${archived} |`);
  }

  if (products.length > 50) {
    lines.push(`\n... и ещё ${products.length - 50} товаров`);
  }

  lines.push(`\n**Всего товаров:** ${products.length}`);

  return lines.join('\n');
}

/**
 * Get detailed product info from Ozon API
 * POST /v3/product/info/list
 */
export async function getProductInfoList(input: GetProductInfoInput): Promise<{
  products: OzonProductInfo[];
  total: number;
}> {
  if (!input.offerIds?.length && !input.productIds?.length && !input.skus?.length) {
    throw new Error('At least one of offerIds, productIds, or skus must be specified');
  }

  const body: Record<string, unknown> = {};

  if (input.offerIds && input.offerIds.length > 0) {
    body.offer_id = input.offerIds;
  }

  if (input.productIds && input.productIds.length > 0) {
    body.product_id = input.productIds.map(String);
  }

  if (input.skus && input.skus.length > 0) {
    body.sku = input.skus.map(String);
  }

  const result = await fetchOzon<{
    items: Array<{
      id: number;
      offer_id: string;
      name: string;
      barcode: string;
      barcodes: string[];
      buybox_price: string;
      description_category_id: number;
      type_id: number;
      created_at: string;
      images: string[];
      primary_image: string;
      status: {
        state: string;
        state_failed: string;
        moderate_status: string;
        decline_reasons: string[];
        validation_state: string;
        state_name: string;
        state_description: string;
        state_tooltip: string;
        item_errors: Array<{
          code: string;
          state: string;
          level: string;
          description: string;
          field: string;
          attribute_id: number;
          attribute_name: string;
        }>;
        state_updated_at: string;
      };
      sources: Array<{ source: string; sku: number }>;
      stocks: {
        coming: number;
        present: number;
        reserved: number;
      };
      errors: string[];
      updated_at: string;
      vat: string;
      visible: boolean;
      visibility_details: {
        has_price: boolean;
        has_stock: boolean;
        active_product: boolean;
        reasons: Record<string, unknown>;
      };
      price_indexes: {
        price_index: string;
        external_index_data: {
          minimal_price: string;
          minimal_price_currency: string;
          price_index_value: number;
        };
        ozon_index_data: {
          minimal_price: string;
          minimal_price_currency: string;
          price_index_value: number;
        };
        self_marketplaces_index_data: {
          minimal_price: string;
          minimal_price_currency: string;
          price_index_value: number;
        };
      };
      is_kgt: boolean;
      color_image: string;
      last_id: string;
    }>;
  }>('/v3/product/info/list', body);

  const products: OzonProductInfo[] = (result.items || []).map((item) => ({
    id: item.id,
    offerId: item.offer_id,
    name: item.name,
    barcode: item.barcode,
    barcodes: item.barcodes || [],
    buyboxPrice: item.buybox_price,
    descriptionCategoryId: item.description_category_id,
    typeId: item.type_id,
    createdAt: item.created_at,
    images: item.images || [],
    primaryImage: item.primary_image,
    status: {
      state: item.status?.state || '',
      stateFailed: item.status?.state_failed || '',
      moderateStatus: item.status?.moderate_status || '',
      declineReasons: item.status?.decline_reasons || [],
      validationState: item.status?.validation_state || '',
      stateName: item.status?.state_name || '',
      stateDescription: item.status?.state_description || '',
      stateTooltip: item.status?.state_tooltip || '',
      itemErrors: (item.status?.item_errors || []).map((e) => ({
        code: e.code,
        state: e.state,
        level: e.level,
        description: e.description,
        field: e.field,
        attributeId: e.attribute_id,
        attributeName: e.attribute_name,
      })),
      stateUpdatedAt: item.status?.state_updated_at || '',
    },
    sources: item.sources || [],
    stocks: item.stocks || { coming: 0, present: 0, reserved: 0 },
    errors: item.errors || [],
    updatedAt: item.updated_at,
    vat: item.vat,
    visible: item.visible,
    visibilityDetails: {
      hasPrice: item.visibility_details?.has_price || false,
      hasStock: item.visibility_details?.has_stock || false,
      activeProduct: item.visibility_details?.active_product || false,
      reasons: item.visibility_details?.reasons || {},
    },
    priceIndexes: {
      priceIndex: item.price_indexes?.price_index || '',
      externalIndexData: {
        minimalPrice: item.price_indexes?.external_index_data?.minimal_price || '',
        minimalPriceCurrency: item.price_indexes?.external_index_data?.minimal_price_currency || '',
        priceIndexValue: item.price_indexes?.external_index_data?.price_index_value || 0,
      },
      ozonIndexData: {
        minimalPrice: item.price_indexes?.ozon_index_data?.minimal_price || '',
        minimalPriceCurrency: item.price_indexes?.ozon_index_data?.minimal_price_currency || '',
        priceIndexValue: item.price_indexes?.ozon_index_data?.price_index_value || 0,
      },
      selfMarketplacesIndexData: {
        minimalPrice: item.price_indexes?.self_marketplaces_index_data?.minimal_price || '',
        minimalPriceCurrency: item.price_indexes?.self_marketplaces_index_data?.minimal_price_currency || '',
        priceIndexValue: item.price_indexes?.self_marketplaces_index_data?.price_index_value || 0,
      },
    },
    isKgt: item.is_kgt,
    colorImage: item.color_image,
    lastId: item.last_id,
  }));

  // Cache products
  for (const product of products) {
    await cacheProduct({
      marketplace: 'ozon',
      productId: product.id.toString(),
      offerId: product.offerId,
      name: product.name,
      barcode: product.barcode,
      rawData: product as unknown as Record<string, unknown>,
    });
  }

  await logRead('ozon_get_product_info', 'products', input, { count: products.length });

  return {
    products,
    total: products.length,
  };
}

/**
 * Format product info as markdown
 */
export function formatProductInfoAsMarkdown(products: OzonProductInfo[]): string {
  if (products.length === 0) {
    return 'Товары не найдены';
  }

  const lines: string[] = [];

  for (const p of products) {
    const statusIcon = p.visible ? '🟢' : '🔴';
    const stateIcon = p.status.state === 'processed' ? '✅' : p.status.state === 'failed' ? '❌' : '⏳';

    lines.push(`## ${p.name || 'Без названия'}`);
    lines.push('');
    lines.push(`| Параметр | Значение |`);
    lines.push(`|----------|----------|`);
    lines.push(`| Product ID | ${p.id} |`);
    lines.push(`| Артикул (offer_id) | ${p.offerId} |`);
    lines.push(`| Штрихкод | ${p.barcode || '-'} |`);
    lines.push(`| Видимость | ${statusIcon} ${p.visible ? 'Виден' : 'Скрыт'} |`);
    lines.push(`| Статус | ${stateIcon} ${p.status.stateName || p.status.state} |`);
    lines.push(`| Модерация | ${p.status.moderateStatus || '-'} |`);
    lines.push(`| Buybox цена | ${p.buyboxPrice || '-'} |`);
    lines.push(`| НДС | ${p.vat} |`);
    lines.push(`| КГТ | ${p.isKgt ? 'Да' : 'Нет'} |`);
    lines.push(`| Создан | ${p.createdAt} |`);
    lines.push(`| Обновлён | ${p.updatedAt} |`);

    // Visibility details
    lines.push('');
    lines.push('### Детали видимости');
    lines.push(`- Есть цена: ${p.visibilityDetails.hasPrice ? '✅' : '❌'}`);
    lines.push(`- Есть остаток: ${p.visibilityDetails.hasStock ? '✅' : '❌'}`);
    lines.push(`- Активный товар: ${p.visibilityDetails.activeProduct ? '✅' : '❌'}`);

    // Stocks
    if (p.stocks) {
      lines.push('');
      lines.push('### Остатки');
      lines.push(`- Доступно: ${p.stocks.present}`);
      lines.push(`- Зарезервировано: ${p.stocks.reserved}`);
      lines.push(`- В пути: ${p.stocks.coming}`);
    }

    // SKUs
    if (p.sources && p.sources.length > 0) {
      lines.push('');
      lines.push('### SKU');
      for (const src of p.sources) {
        lines.push(`- ${src.source}: ${src.sku}`);
      }
    }

    // Errors
    if (p.errors && p.errors.length > 0) {
      lines.push('');
      lines.push('### Ошибки');
      for (const err of p.errors) {
        lines.push(`- ❌ ${err}`);
      }
    }

    if (p.status.itemErrors && p.status.itemErrors.length > 0) {
      lines.push('');
      lines.push('### Ошибки статуса');
      for (const err of p.status.itemErrors) {
        lines.push(`- ❌ [${err.level}] ${err.description} (поле: ${err.field || err.attributeName || '-'})`);
      }
    }

    // Decline reasons
    if (p.status.declineReasons && p.status.declineReasons.length > 0) {
      lines.push('');
      lines.push('### Причины отклонения');
      for (const reason of p.status.declineReasons) {
        lines.push(`- ${reason}`);
      }
    }

    // Images
    if (p.images && p.images.length > 0) {
      lines.push('');
      lines.push(`### Фото (${p.images.length})`);
      lines.push(`Главное: ${p.primaryImage || '-'}`);
    }

    lines.push('');
    lines.push('---');
    lines.push('');
  }

  lines.push(`**Всего товаров:** ${products.length}`);

  return lines.join('\n');
}

/**
 * Update product content on Ozon
 * POST /v1/product/import-by-sku
 */
export async function updateProduct(input: UpdateProductInput): Promise<{
  success: boolean;
  preview: boolean;
  offerId: string;
  changes: Record<string, { old?: string; new: string }>;
  taskId?: number;
  message: string;
}> {
  const { offerId, name, description, images, attributes, confirm } = input;

  // Get current product info first
  const currentInfo = await getProductInfoList({ offerIds: [offerId] });
  const currentProduct = currentInfo.products[0];

  if (!currentProduct) {
    throw new Error(`Товар с артикулом ${offerId} не найден`);
  }

  // Build changes object
  const changes: Record<string, { old?: string; new: string }> = {};

  if (name) {
    changes.name = { old: currentProduct.name, new: name };
  }

  if (description) {
    // Description is in attributes, we'll note it
    changes.description = { new: description };
  }

  if (images && images.length > 0) {
    changes.images = {
      old: `${currentProduct.images?.length || 0} фото`,
      new: `${images.length} фото`,
    };
  }

  if (attributes && attributes.length > 0) {
    changes.attributes = {
      new: `${attributes.length} атрибутов`,
    };
  }

  // Preview mode
  if (!confirm) {
    const previewLines = [
      `📝 PREVIEW: Изменение карточки товара`,
      ``,
      `**Артикул:** ${offerId}`,
      `**Product ID:** ${currentProduct.id}`,
      ``,
      `### Изменения:`,
    ];

    for (const [key, change] of Object.entries(changes)) {
      if (change.old) {
        previewLines.push(`- **${key}:** "${change.old}" → "${change.new}"`);
      } else {
        previewLines.push(`- **${key}:** → "${change.new}"`);
      }
    }

    previewLines.push('');
    previewLines.push('⚠️ Для применения изменений добавьте `confirm=true`');

    await logWriteWithPreview('ozon_update_product', 'product', input as Record<string, unknown>, changes);

    return {
      success: false,
      preview: true,
      offerId,
      changes,
      message: previewLines.join('\n'),
    };
  }

  // Build update payload
  const updateItems: Array<{
    offer_id: string;
    name?: string;
    images?: string[];
    attributes?: Array<{
      id: number;
      values: Array<{ value?: string; dictionary_value_id?: number }>;
    }>;
  }> = [{
    offer_id: offerId,
  }];

  if (name) {
    updateItems[0].name = name;
  }

  if (images && images.length > 0) {
    updateItems[0].images = images;
  }

  // Handle attributes including description
  const updateAttributes: Array<{
    id: number;
    values: Array<{ value?: string; dictionary_value_id?: number }>;
  }> = [];

  // Description is attribute ID 4191 on Ozon
  if (description) {
    updateAttributes.push({
      id: 4191, // Description attribute
      values: [{ value: description }],
    });
  }

  // Add other attributes
  if (attributes) {
    for (const attr of attributes) {
      const attrValue: { value?: string; dictionary_value_id?: number } = {};
      if (attr.value) attrValue.value = attr.value;
      if (attr.dictionaryValueId) attrValue.dictionary_value_id = attr.dictionaryValueId;

      updateAttributes.push({
        id: attr.id,
        values: [attrValue],
      });
    }
  }

  if (updateAttributes.length > 0) {
    updateItems[0].attributes = updateAttributes;
  }

  // Call API
  const result = await fetchOzon<{
    result: {
      task_id: number;
    };
  }>('/v1/product/import-by-sku', {
    items: updateItems,
  });

  await logWriteConfirmed(
    'ozon_update_product',
    'product',
    input as Record<string, unknown>,
    { taskId: result.result?.task_id },
    changes
  );

  return {
    success: true,
    preview: false,
    offerId,
    changes,
    taskId: result.result?.task_id,
    message: `✅ Карточка товара ${offerId} отправлена на обновление\n\nTask ID: ${result.result?.task_id}\n\nИспользуйте \`ozon_get_import_status\` для проверки статуса.`,
  };
}

/**
 * Format update product result as markdown
 */
export function formatUpdateProductResult(result: {
  success: boolean;
  preview: boolean;
  offerId: string;
  changes: Record<string, { old?: string; new: string }>;
  taskId?: number;
  message: string;
}): string {
  return result.message;
}
