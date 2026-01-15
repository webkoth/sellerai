/**
 * Products tools for Yandex Market MCP
 */

import { z } from 'zod';
import { apiRequest, getCampaignId, getBusinessId, ApiResponse } from '../api/client.js';

// Input schemas
export const GetProductsInputSchema = z.object({
  campaignId: z.number().optional().describe('ID магазина (по умолчанию из env)'),
  limit: z.number().min(1).max(200).default(100).optional(),
  pageToken: z.string().optional().describe('Токен для пагинации'),
  archived: z.boolean().default(false).optional().describe('Показывать архивные товары'),
}).strict();

export type GetProductsInput = z.infer<typeof GetProductsInputSchema>;

// Response types
export interface Offer {
  offerId: string;
  name?: string;
  category?: string;
  vendor?: string;
  vendorCode?: string;
  barcodes?: string[];
  description?: string;
  pictures?: string[];
  manufacturer?: string;
  manufacturerCountries?: string[];
  urls?: string[];
  availability?: string;
  transportUnitSize?: number;
  minShipment?: number;
  quantumOfSupply?: number;
  supplyScheduleDays?: string[];
  deliveryDurationDays?: number;
  boxCount?: number;
  shelfLife?: {
    timePeriod?: number;
    timeUnit?: string;
  };
  lifeTime?: {
    timePeriod?: number;
    timeUnit?: string;
  };
  weightDimensions?: {
    length?: number;
    width?: number;
    height?: number;
    weight?: number;
  };
}

export interface OffersResponse {
  result?: {
    offerMappings?: Array<{
      offer: Offer;
      mapping?: {
        marketSku?: number;
        categoryId?: number;
        categoryName?: string;
      };
    }>;
    paging?: {
      nextPageToken?: string;
      prevPageToken?: string;
    };
  };
}

// Get products list
export async function getProducts(input: GetProductsInput): Promise<{
  products: Array<{
    offerId: string;
    name: string;
    category: string;
    vendor: string;
    vendorCode: string;
    barcodes: string[];
    marketSku?: number;
  }>;
  total: number;
  nextPageToken?: string;
}> {
  const campaignId = input.campaignId || parseInt(getCampaignId());

  const body: Record<string, unknown> = {
    limit: input.limit || 100,
    archived: input.archived || false,
  };

  if (input.pageToken) {
    body.page_token = input.pageToken;
  }

  const response = await apiRequest<OffersResponse>(
    `/v2/campaigns/${campaignId}/offers`,
    'POST',
    body
  );

  const products = (response.result?.offerMappings || []).map((item) => ({
    offerId: item.offer.offerId,
    name: item.offer.name || '',
    category: item.mapping?.categoryName || item.offer.category || '',
    vendor: item.offer.vendor || '',
    vendorCode: item.offer.vendorCode || '',
    barcodes: item.offer.barcodes || [],
    marketSku: item.mapping?.marketSku,
  }));

  return {
    products,
    total: products.length,
    nextPageToken: response.result?.paging?.nextPageToken,
  };
}

// Formatters
export function formatProductsAsMarkdown(
  products: Array<{
    offerId: string;
    name: string;
    category: string;
    vendor: string;
    vendorCode: string;
    barcodes: string[];
    marketSku?: number;
  }>,
  nextPageToken?: string
): string {
  if (!products.length) {
    return '## Товары Яндекс.Маркет\n\nТовары не найдены.';
  }

  const lines: string[] = [
    '## Товары Яндекс.Маркет',
    '',
    `Найдено: ${products.length} товаров`,
    '',
    '| Артикул | Название | Категория | Бренд | SKU |',
    '|---------|----------|-----------|-------|-----|',
  ];

  for (const p of products) {
    const name = p.name.length > 40 ? p.name.substring(0, 37) + '...' : p.name;
    const category = p.category.length > 20 ? p.category.substring(0, 17) + '...' : p.category;
    lines.push(`| ${p.offerId} | ${name} | ${category} | ${p.vendor || '-'} | ${p.marketSku || '-'} |`);
  }

  if (nextPageToken) {
    lines.push('');
    lines.push(`> Есть ещё товары. Используйте pageToken: \`${nextPageToken}\``);
  }

  return lines.join('\n');
}

// Update products input schema
export const UpdateProductsInputSchema = z.object({
  businessId: z.number().optional().describe('ID кабинета (по умолчанию из env)'),
  products: z.array(z.object({
    offerId: z.string().describe('Артикул товара'),
    name: z.string().optional().describe('Новое название товара'),
    description: z.string().optional().describe('Новое описание товара'),
    vendor: z.string().optional().describe('Бренд/производитель'),
    vendorCode: z.string().optional().describe('Артикул производителя'),
    barcodes: z.array(z.string()).optional().describe('Штрихкоды'),
    pictures: z.array(z.string()).optional().describe('URL изображений'),
    manufacturer: z.string().optional().describe('Производитель'),
    manufacturerCountries: z.array(z.string()).optional().describe('Страны производства'),
    weightDimensions: z.object({
      length: z.number().optional().describe('Длина в см'),
      width: z.number().optional().describe('Ширина в см'),
      height: z.number().optional().describe('Высота в см'),
      weight: z.number().optional().describe('Вес в кг'),
    }).optional().describe('Габариты и вес'),
  })).describe('Массив товаров для обновления'),
  confirm: z.boolean().optional().default(false)
    .describe('true для применения изменений, false для preview'),
}).strict();

export type UpdateProductsInput = z.infer<typeof UpdateProductsInputSchema>;

// Update products
export async function updateProducts(input: UpdateProductsInput): Promise<{
  success: boolean;
  preview: boolean;
  updated: number;
  errors: Array<{ offerId: string; message: string }>;
  message: string;
}> {
  const businessId = input.businessId || parseInt(getBusinessId());
  const { products, confirm } = input;

  // Preview mode
  if (!confirm) {
    const previewLines = [
      '## Preview обновления товаров Яндекс.Маркет',
      '',
      `Товаров к обновлению: ${products.length}`,
      '',
      '| Артикул | Поля для обновления |',
      '|---------|---------------------|',
    ];

    for (const p of products) {
      const fields: string[] = [];
      if (p.name) fields.push('название');
      if (p.description) fields.push('описание');
      if (p.vendor) fields.push('бренд');
      if (p.pictures) fields.push(`фото (${p.pictures.length})`);
      if (p.weightDimensions) fields.push('габариты');

      previewLines.push(`| ${p.offerId} | ${fields.join(', ') || '-'} |`);
    }

    previewLines.push('');
    previewLines.push('> Для применения изменений добавьте `confirm: true`');

    return {
      success: false,
      preview: true,
      updated: 0,
      errors: [],
      message: previewLines.join('\n'),
    };
  }

  // Apply changes
  const offerMappings = products.map((p) => {
    const offer: Record<string, unknown> = {
      offerId: p.offerId,
    };

    if (p.name) offer.name = p.name;
    if (p.description) offer.description = p.description;
    if (p.vendor) offer.vendor = p.vendor;
    if (p.vendorCode) offer.vendorCode = p.vendorCode;
    if (p.barcodes) offer.barcodes = p.barcodes;
    if (p.pictures) offer.pictures = p.pictures;
    if (p.manufacturer) offer.manufacturer = p.manufacturer;
    if (p.manufacturerCountries) offer.manufacturerCountries = p.manufacturerCountries;
    if (p.weightDimensions) offer.weightDimensions = p.weightDimensions;

    return { offer };
  });

  const response = await apiRequest<{
    status?: string;
    result?: {
      status?: string;
    };
    errors?: Array<{
      code: string;
      message: string;
    }>;
  }>(
    `/businesses/${businessId}/offer-mappings/update`,
    'POST',
    { offerMappings }
  );

  const success = response.status === 'OK' || response.result?.status === 'OK';
  const errors: Array<{ offerId: string; message: string }> = [];

  if (response.errors) {
    for (const err of response.errors) {
      errors.push({
        offerId: 'unknown',
        message: `${err.code}: ${err.message}`,
      });
    }
  }

  return {
    success,
    preview: false,
    updated: success ? products.length : 0,
    errors,
    message: success
      ? `Обновлено товаров: ${products.length}`
      : `Ошибка обновления: ${errors.map((e) => e.message).join(', ')}`,
  };
}

// Format update result
export function formatUpdateProductsResult(result: {
  success: boolean;
  preview: boolean;
  updated: number;
  errors: Array<{ offerId: string; message: string }>;
  message: string;
}): string {
  if (result.preview) {
    return result.message;
  }

  const lines: string[] = [];

  if (result.success) {
    lines.push('## Результат обновления товаров Яндекс.Маркет');
    lines.push('');
    lines.push(`Обновлено: ${result.updated} товаров`);
  } else {
    lines.push('## Ошибка обновления товаров Яндекс.Маркет');
    lines.push('');
    lines.push('Ошибки:');
    for (const err of result.errors) {
      lines.push(`- ${err.offerId}: ${err.message}`);
    }
  }

  return lines.join('\n');
}
