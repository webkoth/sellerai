import { z } from 'zod';
import { createOzonHeaders, OZON_API_URL } from '../utils/auth.js';
import { logRead } from '../utils/logger.js';

// Product item schema for import
const ProductItemSchema = z.object({
  offerId: z.string().describe('Артикул продавца (offer_id) - должен быть уникальным'),
  name: z.string().describe('Название товара'),
  description: z.string().optional().describe('Описание товара'),
  price: z.string().describe('Цена товара (строка, например "1500")'),
  oldPrice: z.string().optional().describe('Старая цена (зачёркнутая)'),
  vat: z.enum(['0', '0.1', '0.2']).optional().default('0').describe('Ставка НДС'),
  images: z.array(z.string()).optional().describe('URL изображений товара'),
  descriptionCategoryId: z.number().describe('ID категории Ozon'),
  barcode: z.string().optional().describe('Штрихкод товара'),
  weight: z.number().optional().describe('Вес в граммах'),
  depth: z.number().optional().describe('Глубина в мм'),
  height: z.number().optional().describe('Высота в мм'),
  width: z.number().optional().describe('Ширина в мм'),
  attributes: z.array(z.object({
    id: z.number().describe('ID атрибута'),
    complexId: z.number().optional().describe('ID для complex атрибутов'),
    value: z.string().optional().describe('Строковое значение'),
    dictionaryValueId: z.number().optional().describe('ID из словаря'),
    values: z.array(z.object({
      dictionaryValueId: z.number().optional(),
      value: z.string().optional(),
    })).optional().describe('Множественные значения'),
  })).optional().describe('Атрибуты товара'),
  complexAttributes: z.array(z.object({
    id: z.number(),
    attributes: z.array(z.object({
      id: z.number(),
      value: z.string().optional(),
      dictionaryValueId: z.number().optional(),
    })),
  })).optional().describe('Сложные атрибуты'),
});

export type ProductItem = z.infer<typeof ProductItemSchema>;

// Input schema for ozon_import_products
export const ImportProductsInputSchema = z.object({
  products: z.array(ProductItemSchema).describe('Массив товаров для импорта'),
  confirm: z.boolean().optional().default(false).describe('true для выполнения импорта, false для preview'),
});

export type ImportProductsInput = z.infer<typeof ImportProductsInputSchema>;

// Input schema for getting categories
export const GetCategoriesInputSchema = z.object({
  parentId: z.number().optional().default(0).describe('ID родительской категории (0 для корневых)'),
  language: z.enum(['DEFAULT', 'RU', 'EN', 'ZH_HANS']).optional().default('RU').describe('Язык'),
});

export type GetCategoriesInput = z.infer<typeof GetCategoriesInputSchema>;

// Input schema for getting category attributes
export const GetCategoryAttributesInputSchema = z.object({
  categoryId: z.number().describe('ID категории'),
  typeId: z.number().optional().default(0).describe('ID типа товара'),
  language: z.enum(['DEFAULT', 'RU', 'EN', 'ZH_HANS']).optional().default('RU').describe('Язык'),
});

export type GetCategoryAttributesInput = z.infer<typeof GetCategoryAttributesInputSchema>;

// Input schema for import status
export const GetImportStatusInputSchema = z.object({
  taskId: z.number().describe('ID задачи импорта'),
});

export type GetImportStatusInput = z.infer<typeof GetImportStatusInputSchema>;

// Category interface
interface OzonCategory {
  categoryId: number;
  categoryName: string;
  disabled: boolean;
  children?: OzonCategory[];
}

// Category attribute interface
interface OzonCategoryAttribute {
  id: number;
  name: string;
  description: string;
  type: string;
  isCollection: boolean;
  isRequired: boolean;
  groupId: number;
  groupName: string;
  dictionaryId: number;
  maxValueCount: number;
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
 * Get Ozon categories
 * POST /v1/description-category/tree
 */
export async function getCategories(input: GetCategoriesInput): Promise<{
  categories: OzonCategory[];
  total: number;
}> {
  const result = await fetchOzon<{
    result: Array<{
      description_category_id: number;
      category_name: string;
      disabled: boolean;
      children?: Array<{
        description_category_id: number;
        category_name: string;
        disabled: boolean;
        children?: unknown[];
      }>;
    }>;
  }>('/v1/description-category/tree', {
    language: input.language || 'RU',
  });

  const mapCategory = (cat: {
    description_category_id: number;
    category_name: string;
    disabled: boolean;
    children?: unknown[];
  }): OzonCategory => ({
    categoryId: cat.description_category_id,
    categoryName: cat.category_name,
    disabled: cat.disabled,
    children: cat.children?.map((c) => mapCategory(c as {
      description_category_id: number;
      category_name: string;
      disabled: boolean;
      children?: unknown[];
    })),
  });

  const categories = (result.result || []).map(mapCategory);

  // Filter by parent if specified
  let filtered = categories;
  if (input.parentId && input.parentId > 0) {
    const findChildren = (cats: OzonCategory[], targetId: number): OzonCategory[] => {
      for (const cat of cats) {
        if (cat.categoryId === targetId) {
          return cat.children || [];
        }
        if (cat.children) {
          const found = findChildren(cat.children, targetId);
          if (found.length > 0) return found;
        }
      }
      return [];
    };
    filtered = findChildren(categories, input.parentId);
  }

  await logRead('ozon_get_categories', 'categories', input, { count: filtered.length });

  return {
    categories: filtered,
    total: filtered.length,
  };
}

/**
 * Get category attributes
 * POST /v1/description-category/attribute
 */
export async function getCategoryAttributes(input: GetCategoryAttributesInput): Promise<{
  attributes: OzonCategoryAttribute[];
  total: number;
}> {
  const result = await fetchOzon<{
    result: Array<{
      id: number;
      name: string;
      description: string;
      type: string;
      is_collection: boolean;
      is_required: boolean;
      group_id: number;
      group_name: string;
      dictionary_id: number;
      max_value_count: number;
    }>;
  }>('/v1/description-category/attribute', {
    description_category_id: input.categoryId,
    type_id: input.typeId || 0,
    language: input.language || 'RU',
  });

  const attributes = (result.result || []).map((attr) => ({
    id: attr.id,
    name: attr.name,
    description: attr.description,
    type: attr.type,
    isCollection: attr.is_collection,
    isRequired: attr.is_required,
    groupId: attr.group_id,
    groupName: attr.group_name,
    dictionaryId: attr.dictionary_id,
    maxValueCount: attr.max_value_count,
  }));

  await logRead('ozon_get_category_attributes', 'attributes', input, { count: attributes.length });

  return {
    attributes,
    total: attributes.length,
  };
}

/**
 * Import products to Ozon
 * POST /v3/product/import
 */
export async function importProducts(input: ImportProductsInput): Promise<{
  preview: boolean;
  taskId?: number;
  products: Array<{
    offerId: string;
    name: string;
    price: string;
    status: string;
    errors?: string[];
  }>;
}> {
  // Preview mode - just show what would be imported
  if (!input.confirm) {
    const products = input.products.map((p) => ({
      offerId: p.offerId,
      name: p.name,
      price: p.price,
      status: 'preview',
      errors: validateProduct(p),
    }));

    return {
      preview: true,
      products,
    };
  }

  // Build import request
  const items = input.products.map((p) => ({
    offer_id: p.offerId,
    name: p.name,
    description: p.description || '',
    price: p.price,
    old_price: p.oldPrice || '0',
    vat: p.vat || '0',
    description_category_id: p.descriptionCategoryId,
    images: (p.images || []).map((url) => url),
    barcode: p.barcode,
    weight: p.weight || 100,
    dimension_unit: 'mm',
    weight_unit: 'g',
    depth: p.depth || 100,
    height: p.height || 100,
    width: p.width || 100,
    attributes: (p.attributes || []).map((attr) => ({
      id: attr.id,
      complex_id: attr.complexId || 0,
      values: attr.values || [{ value: attr.value || '', dictionary_value_id: attr.dictionaryValueId }],
    })),
    complex_attributes: p.complexAttributes || [],
    currency_code: 'RUB',
  }));

  const result = await fetchOzon<{
    result: {
      task_id: number;
    };
  }>('/v3/product/import', {
    items,
  });

  const taskId = result.result?.task_id;

  await logRead('ozon_import_products', 'import', input, { taskId, count: items.length });

  return {
    preview: false,
    taskId,
    products: input.products.map((p) => ({
      offerId: p.offerId,
      name: p.name,
      price: p.price,
      status: 'queued',
    })),
  };
}

/**
 * Get import status
 * POST /v1/product/import/info
 */
export async function getImportStatus(input: GetImportStatusInput): Promise<{
  taskId: number;
  status: string;
  total: number;
  items: Array<{
    offerId: string;
    productId?: number;
    status: string;
    errors?: Array<{ code: string; message: string }>;
  }>;
}> {
  const result = await fetchOzon<{
    result: {
      items: Array<{
        offer_id: string;
        product_id?: number;
        status: string;
        errors?: Array<{ code: string; message: string }>;
      }>;
      total: number;
    };
  }>('/v1/product/import/info', {
    task_id: input.taskId,
  });

  const items = (result.result?.items || []).map((item) => ({
    offerId: item.offer_id,
    productId: item.product_id,
    status: item.status,
    errors: item.errors,
  }));

  // Determine overall status
  const hasErrors = items.some((i) => i.errors && i.errors.length > 0);
  const allProcessed = items.every((i) => i.status === 'imported' || i.status === 'failed');
  const status = hasErrors ? 'has_errors' : allProcessed ? 'completed' : 'processing';

  return {
    taskId: input.taskId,
    status,
    total: result.result?.total || items.length,
    items,
  };
}

/**
 * Validate product before import
 */
function validateProduct(product: ProductItem): string[] {
  const errors: string[] = [];

  if (!product.offerId) {
    errors.push('offer_id обязателен');
  }
  if (!product.name) {
    errors.push('name обязателен');
  }
  if (!product.price) {
    errors.push('price обязателен');
  }
  if (!product.descriptionCategoryId) {
    errors.push('descriptionCategoryId обязателен');
  }
  if (!product.images || product.images.length === 0) {
    errors.push('images обязательны (минимум 1 фото)');
  }

  return errors;
}

/**
 * Format import result as markdown
 */
export function formatImportResultAsMarkdown(result: {
  preview: boolean;
  taskId?: number;
  products: Array<{
    offerId: string;
    name: string;
    price: string;
    status: string;
    errors?: string[];
  }>;
}): string {
  const lines: string[] = [];

  if (result.preview) {
    lines.push('## Preview импорта товаров');
    lines.push('');
    lines.push('> Это preview. Для выполнения импорта используйте `confirm: true`');
    lines.push('');
  } else {
    lines.push('## Импорт товаров запущен');
    lines.push('');
    lines.push(`**Task ID:** ${result.taskId}`);
    lines.push('');
    lines.push('> Используйте `ozon_get_import_status` для проверки статуса');
    lines.push('');
  }

  lines.push('| Артикул | Название | Цена | Статус | Ошибки |');
  lines.push('|---------|----------|------|--------|--------|');

  for (const p of result.products) {
    const name = p.name.length > 30 ? p.name.substring(0, 30) + '...' : p.name;
    const errors = p.errors && p.errors.length > 0 ? p.errors.join('; ') : '-';
    const statusIcon = p.status === 'preview' ? '👁️' : p.status === 'queued' ? '⏳' : p.errors?.length ? '❌' : '✅';
    lines.push(`| ${p.offerId} | ${name} | ${p.price}₽ | ${statusIcon} ${p.status} | ${errors} |`);
  }

  lines.push('');
  lines.push(`**Всего товаров:** ${result.products.length}`);

  return lines.join('\n');
}

/**
 * Format categories as markdown
 */
export function formatCategoriesAsMarkdown(categories: OzonCategory[], level = 0): string {
  if (categories.length === 0) {
    return 'Категории не найдены';
  }

  const lines: string[] = [];

  if (level === 0) {
    lines.push('## Категории Ozon');
    lines.push('');
    lines.push('| ID | Название | Статус |');
    lines.push('|----|----------|--------|');
  }

  for (const cat of categories) {
    const indent = '  '.repeat(level);
    const status = cat.disabled ? '🔴 Неактивна' : '🟢 Активна';
    lines.push(`| ${cat.categoryId} | ${indent}${cat.categoryName} | ${status} |`);

    if (cat.children && cat.children.length > 0) {
      lines.push(formatCategoriesAsMarkdown(cat.children, level + 1));
    }
  }

  if (level === 0) {
    lines.push('');
    lines.push(`**Всего категорий:** ${categories.length}`);
  }

  return lines.join('\n');
}

/**
 * Format attributes as markdown
 */
export function formatAttributesAsMarkdown(attributes: OzonCategoryAttribute[]): string {
  if (attributes.length === 0) {
    return 'Атрибуты не найдены';
  }

  const lines: string[] = [];
  lines.push('## Атрибуты категории');
  lines.push('');

  // Required attributes
  const required = attributes.filter((a) => a.isRequired);
  const optional = attributes.filter((a) => !a.isRequired);

  if (required.length > 0) {
    lines.push('### Обязательные атрибуты');
    lines.push('');
    lines.push('| ID | Название | Тип | Описание |');
    lines.push('|----|----------|-----|----------|');
    for (const attr of required) {
      const desc = attr.description.length > 40 ? attr.description.substring(0, 40) + '...' : attr.description;
      lines.push(`| ${attr.id} | ${attr.name} | ${attr.type} | ${desc} |`);
    }
    lines.push('');
  }

  if (optional.length > 0) {
    lines.push('### Опциональные атрибуты');
    lines.push('');
    lines.push('| ID | Название | Тип | Описание |');
    lines.push('|----|----------|-----|----------|');
    for (const attr of optional.slice(0, 20)) {
      const desc = attr.description.length > 40 ? attr.description.substring(0, 40) + '...' : attr.description;
      lines.push(`| ${attr.id} | ${attr.name} | ${attr.type} | ${desc} |`);
    }
    if (optional.length > 20) {
      lines.push(`\n... и ещё ${optional.length - 20} атрибутов`);
    }
    lines.push('');
  }

  lines.push(`**Обязательных:** ${required.length}, **Опциональных:** ${optional.length}`);

  return lines.join('\n');
}

/**
 * Format import status as markdown
 */
export function formatImportStatusAsMarkdown(result: {
  taskId: number;
  status: string;
  total: number;
  items: Array<{
    offerId: string;
    productId?: number;
    status: string;
    errors?: Array<{ code: string; message: string }>;
  }>;
}): string {
  const lines: string[] = [];

  const statusIcon = result.status === 'completed' ? '✅' : result.status === 'has_errors' ? '⚠️' : '⏳';

  lines.push(`## Статус импорта: ${statusIcon} ${result.status}`);
  lines.push('');
  lines.push(`**Task ID:** ${result.taskId}`);
  lines.push(`**Всего товаров:** ${result.total}`);
  lines.push('');

  lines.push('| Артикул | Product ID | Статус | Ошибки |');
  lines.push('|---------|------------|--------|--------|');

  for (const item of result.items) {
    const productId = item.productId || '-';
    const status = item.status === 'imported' ? '✅ imported' : item.status === 'failed' ? '❌ failed' : `⏳ ${item.status}`;
    const errors = item.errors && item.errors.length > 0
      ? item.errors.map((e) => e.message).join('; ')
      : '-';
    lines.push(`| ${item.offerId} | ${productId} | ${status} | ${errors} |`);
  }

  return lines.join('\n');
}
