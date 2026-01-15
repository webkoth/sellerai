/**
 * Yandex Market Partner API Client
 */

const API_BASE_URL = 'https://api.partner.market.yandex.ru';
const API_TOKEN = process.env.YM_API_TOKEN;
const BUSINESS_ID = process.env.YM_BUSINESS_ID;
const CAMPAIGN_ID = process.env.YM_CAMPAIGN_ID;

export function getBusinessId(): string {
  if (!BUSINESS_ID) {
    throw new Error('YM_BUSINESS_ID environment variable is required');
  }
  return BUSINESS_ID;
}

export function getCampaignId(): string {
  if (!CAMPAIGN_ID) {
    throw new Error('YM_CAMPAIGN_ID environment variable is required');
  }
  return CAMPAIGN_ID;
}

export interface ApiResponse<T> {
  status?: string;
  result?: T;
  errors?: Array<{
    code: string;
    message: string;
  }>;
}

export interface PagingResponse {
  nextPageToken?: string;
  prevPageToken?: string;
}

export async function apiRequest<T>(
  endpoint: string,
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET',
  body?: unknown
): Promise<T> {
  if (!API_TOKEN) {
    throw new Error('YM_API_TOKEN environment variable is required');
  }

  const url = `${API_BASE_URL}${endpoint}`;

  const headers: Record<string, string> = {
    'Api-Key': API_TOKEN,
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  };

  const options: RequestInit = {
    method,
    headers,
  };

  if (body && (method === 'POST' || method === 'PUT')) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(url, options);

  if (!response.ok) {
    const errorText = await response.text();
    let errorMessage = `API Error: ${response.status} ${response.statusText}`;

    try {
      const errorJson = JSON.parse(errorText);
      if (errorJson.errors && errorJson.errors.length > 0) {
        errorMessage = errorJson.errors.map((e: { code: string; message: string }) =>
          `${e.code}: ${e.message}`
        ).join('; ');
      }
    } catch {
      errorMessage = errorText || errorMessage;
    }

    throw new Error(errorMessage);
  }

  const data = await response.json() as T & {
    status?: string;
    errors?: Array<{ code: string; message: string }>;
  };

  if (data.status === 'ERROR' && data.errors) {
    throw new Error(data.errors.map((e) =>
      `${e.code}: ${e.message}`
    ).join('; '));
  }

  return data as T;
}

export async function paginatedRequest<T>(
  endpoint: string,
  body: Record<string, unknown> = {},
  limit: number = 100
): Promise<T[]> {
  const results: T[] = [];
  let pageToken: string | undefined;

  do {
    const requestBody = {
      ...body,
      limit,
      ...(pageToken ? { page_token: pageToken } : {}),
    };

    const response = await apiRequest<ApiResponse<{ items?: T[]; paging?: PagingResponse }>>(
      endpoint,
      'POST',
      requestBody
    );

    if (response.result?.items) {
      results.push(...response.result.items);
    }

    pageToken = response.result?.paging?.nextPageToken;
  } while (pageToken && results.length < limit);

  return results.slice(0, limit);
}
