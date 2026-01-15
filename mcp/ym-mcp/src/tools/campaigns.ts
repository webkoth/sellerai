/**
 * Campaigns tools for Yandex Market MCP
 */

import { z } from 'zod';
import { apiRequest } from '../api/client.js';

// Input schemas
export const GetCampaignsInputSchema = z.object({
  limit: z.number().min(1).max(100).default(50).optional(),
}).strict();

export const GetCampaignInputSchema = z.object({
  campaignId: z.number().describe('ID магазина (campaignId)'),
}).strict();

export type GetCampaignsInput = z.infer<typeof GetCampaignsInputSchema>;
export type GetCampaignInput = z.infer<typeof GetCampaignInputSchema>;

// Response types
export interface Campaign {
  id: number;
  clientId: number;
  domain: string;
  state: number;
  stateReasons: string[];
  placementType: string;
}

export interface CampaignResponse {
  campaigns: Campaign[];
  pager?: {
    total: number;
    from: number;
    to: number;
    pageSize: number;
    pagesCount: number;
    currentPage: number;
  };
}

export interface CampaignDetailsResponse {
  campaign: Campaign & {
    business?: {
      id: number;
      name: string;
    };
  };
}

// Get campaigns list
export async function getCampaigns(input: GetCampaignsInput): Promise<{
  campaigns: Campaign[];
  total: number;
}> {
  const response = await apiRequest<CampaignResponse>(
    `/v2/campaigns?pageSize=${input.limit || 50}`,
    'GET'
  );

  return {
    campaigns: response.campaigns || [],
    total: response.pager?.total || response.campaigns?.length || 0,
  };
}

// Get single campaign
export async function getCampaign(input: GetCampaignInput): Promise<{
  campaign: Campaign | null;
}> {
  const response = await apiRequest<CampaignDetailsResponse>(
    `/v2/campaigns/${input.campaignId}`,
    'GET'
  );

  return {
    campaign: response.campaign || null,
  };
}

// Formatters
const placementTypeNames: Record<string, string> = {
  FBS: 'FBS (склад продавца, доставка Маркетом)',
  FBY: 'FBY (склад Маркета)',
  DBS: 'DBS (склад и доставка продавца)',
  EXPRESS: 'Express (экспресс-доставка)',
};

const stateNames: Record<number, string> = {
  1: '✅ Активен',
  2: '⏸️ Приостановлен',
  3: '❌ Заблокирован',
};

export function formatCampaignsAsMarkdown(campaigns: Campaign[]): string {
  if (!campaigns.length) {
    return '## Магазины Яндекс.Маркет\n\nМагазины не найдены.';
  }

  const lines: string[] = ['## Магазины Яндекс.Маркет', ''];

  for (const campaign of campaigns) {
    const state = stateNames[campaign.state] || `Статус: ${campaign.state}`;
    const placement = placementTypeNames[campaign.placementType] || campaign.placementType;

    lines.push(`### ${campaign.domain || `Магазин #${campaign.id}`}`);
    lines.push(`- **ID (campaignId):** ${campaign.id}`);
    lines.push(`- **Статус:** ${state}`);
    lines.push(`- **Модель:** ${placement}`);

    if (campaign.stateReasons?.length > 0) {
      lines.push(`- **Причины статуса:** ${campaign.stateReasons.join(', ')}`);
    }

    lines.push('');
  }

  return lines.join('\n');
}

export function formatCampaignAsMarkdown(campaign: Campaign | null): string {
  if (!campaign) {
    return '## Магазин Яндекс.Маркет\n\nМагазин не найден.';
  }

  const state = stateNames[campaign.state] || `Статус: ${campaign.state}`;
  const placement = placementTypeNames[campaign.placementType] || campaign.placementType;

  const lines: string[] = [
    `## Магазин: ${campaign.domain || `#${campaign.id}`}`,
    '',
    `- **ID (campaignId):** ${campaign.id}`,
    `- **Client ID:** ${campaign.clientId}`,
    `- **Статус:** ${state}`,
    `- **Модель:** ${placement}`,
  ];

  if (campaign.stateReasons?.length > 0) {
    lines.push(`- **Причины статуса:** ${campaign.stateReasons.join(', ')}`);
  }

  return lines.join('\n');
}
