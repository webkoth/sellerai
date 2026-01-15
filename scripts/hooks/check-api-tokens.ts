#!/usr/bin/env npx ts-node
/**
 * SessionStart Hook: Проверка API токенов маркетплейсов
 *
 * Проверяет наличие и валидность токенов:
 * - WB_API_TOKEN
 * - OZON_CLIENT_ID + OZON_API_TOKEN
 * - YM_TOKEN + YM_BUSINESS_ID + YM_CAMPAIGN_ID
 */

import { SessionStartOutput, writeOutput } from './types';

interface TokenStatus {
  name: string;
  configured: boolean;
  valid?: boolean;
  error?: string;
}

interface MarketplaceStatus {
  marketplace: string;
  status: 'ready' | 'partial' | 'missing';
  tokens: TokenStatus[];
}

function checkWildberries(): MarketplaceStatus {
  const token = process.env.WB_API_TOKEN;

  const tokens: TokenStatus[] = [
    {
      name: 'WB_API_TOKEN',
      configured: Boolean(token && token.length > 0),
    },
  ];

  const configured = tokens.every((t) => t.configured);

  return {
    marketplace: 'Wildberries',
    status: configured ? 'ready' : 'missing',
    tokens,
  };
}

function checkOzon(): MarketplaceStatus {
  const clientId = process.env.OZON_CLIENT_ID;
  const apiToken = process.env.OZON_API_TOKEN;

  const tokens: TokenStatus[] = [
    {
      name: 'OZON_CLIENT_ID',
      configured: Boolean(clientId && clientId.length > 0),
    },
    {
      name: 'OZON_API_TOKEN',
      configured: Boolean(apiToken && apiToken.length > 0),
    },
  ];

  const allConfigured = tokens.every((t) => t.configured);
  const someConfigured = tokens.some((t) => t.configured);

  return {
    marketplace: 'Ozon',
    status: allConfigured ? 'ready' : someConfigured ? 'partial' : 'missing',
    tokens,
  };
}

function checkYandexMarket(): MarketplaceStatus {
  const token = process.env.YM_TOKEN;
  const businessId = process.env.YM_BUSINESS_ID;
  const campaignId = process.env.YM_CAMPAIGN_ID;

  const tokens: TokenStatus[] = [
    {
      name: 'YM_TOKEN',
      configured: Boolean(token && token.length > 0),
    },
    {
      name: 'YM_BUSINESS_ID',
      configured: Boolean(businessId && businessId.length > 0),
    },
    {
      name: 'YM_CAMPAIGN_ID',
      configured: Boolean(campaignId && campaignId.length > 0),
    },
  ];

  const allConfigured = tokens.every((t) => t.configured);
  const someConfigured = tokens.some((t) => t.configured);

  return {
    marketplace: 'Яндекс.Маркет',
    status: allConfigured ? 'ready' : someConfigured ? 'partial' : 'missing',
    tokens,
  };
}

function formatStatus(statuses: MarketplaceStatus[]): string {
  const lines: string[] = ['## Статус подключения маркетплейсов', ''];

  for (const mp of statuses) {
    const icon = mp.status === 'ready' ? '🟢' : mp.status === 'partial' ? '🟡' : '🔴';
    const statusText = mp.status === 'ready' ? 'Готов' : mp.status === 'partial' ? 'Частично' : 'Не настроен';

    lines.push(`${icon} **${mp.marketplace}**: ${statusText}`);

    // Показываем детали только если есть проблемы
    if (mp.status !== 'ready') {
      const missing = mp.tokens.filter((t) => !t.configured).map((t) => t.name);
      if (missing.length > 0) {
        lines.push(`   Не настроены: ${missing.join(', ')}`);
      }
    }
  }

  // Добавляем подсказку если есть проблемы
  const hasProblems = statuses.some((s) => s.status !== 'ready');
  if (hasProblems) {
    lines.push('');
    lines.push('> Настройте токены в `.env` файле. См. CLAUDE.md для инструкций.');
  }

  return lines.join('\n');
}

function main(): void {
  try {
    const statuses: MarketplaceStatus[] = [
      checkWildberries(),
      checkOzon(),
      checkYandexMarket(),
    ];

    const allReady = statuses.every((s) => s.status === 'ready');

    // Выводим сообщение только если есть проблемы
    const output: SessionStartOutput = {};

    if (!allReady) {
      output.systemMessage = formatStatus(statuses);
    }

    writeOutput(output);
  } catch (error) {
    // Ошибка проверки не должна блокировать работу
    writeOutput({});
  }
}

main();
