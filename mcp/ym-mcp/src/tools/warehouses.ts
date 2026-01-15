/**
 * Warehouses and Quality tools for Yandex Market MCP
 */

import { z } from 'zod';
import { apiRequest, getBusinessId, getCampaignId } from '../api/client.js';

// Input schemas
export const GetWarehousesInputSchema = z.object({
  businessId: z.number().optional().describe('ID кабинета (по умолчанию из env)'),
}).strict();

export const GetQualityRatingInputSchema = z.object({
  businessId: z.number().optional().describe('ID кабинета (по умолчанию из env)'),
  campaignIds: z.array(z.number()).optional().describe('Фильтр по ID магазинов'),
}).strict();

export type GetWarehousesInput = z.infer<typeof GetWarehousesInputSchema>;
export type GetQualityRatingInput = z.infer<typeof GetQualityRatingInputSchema>;

// Response types
interface Warehouse {
  id: number;
  name: string;
  campaignId?: number;
  address?: {
    city?: string;
    street?: string;
    house?: string;
    postcode?: string;
    fullAddress?: string;
  };
  type?: string;
}

interface WarehousesResponse {
  result?: {
    warehouses?: Warehouse[];
  };
}

interface QualityRating {
  campaignId: number;
  rating?: number;
  actualIndexCalculationDate?: string;
  dateFrom?: string;
  dateTo?: string;
  planIndexFrom?: string;
  planIndexTo?: string;
  components?: Array<{
    componentType: string;
    value: number;
    threshold?: number;
    status?: string;
  }>;
}

interface QualityResponse {
  result?: {
    ratings?: QualityRating[];
  };
}

// Get warehouses
export async function getWarehouses(input: GetWarehousesInput): Promise<{
  warehouses: Array<{
    id: number;
    name: string;
    campaignId?: number;
    city: string;
    address: string;
    type: string;
  }>;
  total: number;
}> {
  const businessId = input.businessId || parseInt(getBusinessId());

  const response = await apiRequest<WarehousesResponse>(
    `/v2/businesses/${businessId}/warehouses`,
    'POST',
    {}
  );

  const warehouses = (response.result?.warehouses || []).map((wh) => ({
    id: wh.id,
    name: wh.name,
    campaignId: wh.campaignId,
    city: wh.address?.city || '',
    address: wh.address?.fullAddress || [wh.address?.city, wh.address?.street, wh.address?.house].filter(Boolean).join(', '),
    type: wh.type || 'FBS',
  }));

  return {
    warehouses,
    total: warehouses.length,
  };
}

// Get quality rating
export async function getQualityRating(input: GetQualityRatingInput): Promise<{
  ratings: Array<{
    campaignId: number;
    rating: number;
    calculatedAt: string;
    status: string;
    components: Array<{
      name: string;
      value: number;
      threshold: number;
      status: string;
    }>;
  }>;
  total: number;
}> {
  const businessId = input.businessId || parseInt(getBusinessId());

  const body: Record<string, unknown> = {};

  if (input.campaignIds?.length) {
    body.campaignIds = input.campaignIds;
  }

  const response = await apiRequest<QualityResponse>(
    `/v2/businesses/${businessId}/ratings/quality`,
    'POST',
    body
  );

  const ratings = (response.result?.ratings || []).map((r) => {
    // Determine overall status based on rating
    let status = '✅ Хорошо';
    if (r.rating !== undefined) {
      if (r.rating < 70) {
        status = '🔴 Критично';
      } else if (r.rating < 85) {
        status = '🟡 Внимание';
      }
    }

    return {
      campaignId: r.campaignId,
      rating: r.rating || 0,
      calculatedAt: r.actualIndexCalculationDate || '',
      status,
      components: (r.components || []).map((c) => {
        let componentStatus = '✅';
        if (c.status === 'WARNING') componentStatus = '🟡';
        if (c.status === 'FAIL') componentStatus = '🔴';

        return {
          name: componentTypeNames[c.componentType] || c.componentType,
          value: c.value,
          threshold: c.threshold || 0,
          status: componentStatus,
        };
      }),
    };
  });

  return {
    ratings,
    total: ratings.length,
  };
}

// Component type translations
const componentTypeNames: Record<string, string> = {
  CANCELLATION_RATE: 'Отмены',
  LATE_SHIP_RATE: 'Опоздания отгрузок',
  RETURN_RATE: 'Возвраты',
  DELIVERY_LATE_RATE: 'Опоздания доставки',
  DEFECT_RATE: 'Брак',
  PLAN_FACT_RATE: 'План-факт',
};

// Formatters
export function formatWarehousesAsMarkdown(
  warehouses: Array<{
    id: number;
    name: string;
    campaignId?: number;
    city: string;
    address: string;
    type: string;
  }>
): string {
  if (!warehouses.length) {
    return '## Склады Яндекс.Маркет\n\nСклады не найдены.';
  }

  const lines: string[] = [
    '## Склады Яндекс.Маркет',
    '',
    `Найдено: ${warehouses.length} складов`,
    '',
    '| ID | Название | Тип | Город | Адрес |',
    '|----|----------|-----|-------|-------|',
  ];

  for (const wh of warehouses) {
    const address = wh.address.length > 30 ? wh.address.substring(0, 27) + '...' : wh.address;
    lines.push(`| ${wh.id} | ${wh.name} | ${wh.type} | ${wh.city || '-'} | ${address || '-'} |`);
  }

  return lines.join('\n');
}

export function formatQualityRatingAsMarkdown(
  ratings: Array<{
    campaignId: number;
    rating: number;
    calculatedAt: string;
    status: string;
    components: Array<{
      name: string;
      value: number;
      threshold: number;
      status: string;
    }>;
  }>
): string {
  if (!ratings.length) {
    return '## Индекс качества Яндекс.Маркет\n\nДанные не найдены.';
  }

  const lines: string[] = [
    '## Индекс качества Яндекс.Маркет',
    '',
  ];

  for (const r of ratings) {
    const date = r.calculatedAt
      ? new Date(r.calculatedAt).toLocaleDateString('ru-RU')
      : '-';

    lines.push(`### Магазин ${r.campaignId}`);
    lines.push('');
    lines.push(`**Рейтинг:** ${r.rating}% ${r.status}`);
    lines.push(`**Рассчитан:** ${date}`);
    lines.push('');

    if (r.components.length > 0) {
      lines.push('**Компоненты:**');
      lines.push('');
      lines.push('| Показатель | Значение | Порог | Статус |');
      lines.push('|------------|----------|-------|--------|');

      for (const c of r.components) {
        lines.push(`| ${c.name} | ${c.value}% | ${c.threshold}% | ${c.status} |`);
      }
    }

    lines.push('');
  }

  return lines.join('\n');
}
