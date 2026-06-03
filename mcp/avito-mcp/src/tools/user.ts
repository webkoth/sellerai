/**
 * Avito User Tools
 *
 * Профиль продавца и баланс.
 */

import { z } from 'zod';
import { fetchAvito } from '../api/client.js';

// --- Input Schemas ---

export const GetUserInfoInputSchema = z.object({});

export type GetUserInfoInput = z.infer<typeof GetUserInfoInputSchema>;

// --- Response Types ---

interface AvitoUserInfo {
  id: number;
  name: string;
  email?: string;
  phone?: string;
  profileUrl?: string;
  balance?: {
    real: number;
    bonus: number;
  };
  operationsHistory?: Array<{
    id: number;
    type: string;
    amount: number;
    date: string;
    description?: string;
  }>;
}

// --- API Functions ---

export async function getUserInfo(): Promise<{
  user: AvitoUserInfo;
}> {
  const selfData = await fetchAvito<{
    id: number;
    name?: string;
    email?: string;
    phone?: string;
    profile_url?: string;
  }>('/core/v1/accounts/self');

  const userId = selfData.id;

  // Fetch balance
  let balance: { real: number; bonus: number } | undefined;
  try {
    const balanceData = await fetchAvito<{
      real?: number;
      bonus?: number;
    }>(`/core/v1/accounts/${userId}/balance/`);
    balance = {
      real: balanceData.real || 0,
      bonus: balanceData.bonus || 0,
    };
  } catch {
    // Balance API might not be available
  }

  // Fetch operations history
  let operationsHistory: AvitoUserInfo['operationsHistory'];
  try {
    const opsData = await fetchAvito<{
      operations?: Array<{
        id: number;
        operationType: string;
        amountTotal: number;
        updatedAt: string;
        serviceName?: string;
      }>;
    }>(`/core/v1/accounts/${userId}/operations_history/?limit=20`);

    operationsHistory = (opsData.operations || []).map(op => ({
      id: op.id,
      type: op.operationType,
      amount: op.amountTotal,
      date: op.updatedAt,
      description: op.serviceName,
    }));
  } catch {
    // Operations API might not be available
  }

  return {
    user: {
      id: userId,
      name: selfData.name || '',
      email: selfData.email,
      phone: selfData.phone,
      profileUrl: selfData.profile_url,
      balance,
      operationsHistory,
    },
  };
}

// --- Markdown Formatters ---

export function formatUserInfoAsMarkdown(user: AvitoUserInfo): string {
  const lines = [
    '## Профиль Авито',
    '',
    `- **ID:** ${user.id}`,
    `- **Имя:** ${user.name}`,
  ];

  if (user.email) lines.push(`- **Email:** ${user.email}`);
  if (user.phone) lines.push(`- **Телефон:** ${user.phone}`);
  if (user.profileUrl) lines.push(`- **URL:** ${user.profileUrl}`);

  if (user.balance) {
    lines.push(
      '',
      '### Баланс',
      `- **Основной:** ${(user.balance.real / 100).toLocaleString('ru-RU')}₽`,
      `- **Бонусный:** ${(user.balance.bonus / 100).toLocaleString('ru-RU')}₽`,
    );
  }

  if (user.operationsHistory && user.operationsHistory.length > 0) {
    lines.push(
      '',
      '### Последние операции',
      '',
      '| Дата | Тип | Сумма | Описание |',
      '|------|-----|-------|----------|',
    );

    for (const op of user.operationsHistory.slice(0, 10)) {
      const date = op.date ? op.date.split('T')[0] : '';
      const amount = `${(op.amount / 100).toLocaleString('ru-RU')}₽`;
      lines.push(`| ${date} | ${op.type} | ${amount} | ${op.description || '—'} |`);
    }
  }

  return lines.join('\n');
}
