/**
 * Avito API Client
 *
 * OAuth2 client_credentials flow + unified fetch helper.
 * Token auto-refreshes on 403 (Avito returns 403, not 401, on expired tokens).
 */

import { config } from 'dotenv';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '../../../../');
config({ path: join(projectRoot, '.env') });

const API_BASE_URL = 'https://api.avito.ru';

// --- OAuth2 Token Management ---

interface TokenData {
  accessToken: string;
  expiresAt: number; // Unix timestamp ms
}

let cachedToken: TokenData | null = null;

function getClientId(): string {
  const id = process.env.AVITO_CLIENT_ID?.replace(/^["']|["']$/g, '');
  if (!id) {
    throw new Error(
      'AVITO_CLIENT_ID not found. Set it in .env file:\n' +
      '  AVITO_CLIENT_ID="your_client_id"\n' +
      'Get credentials at https://developers.avito.ru/'
    );
  }
  return id;
}

function getClientSecret(): string {
  const secret = process.env.AVITO_CLIENT_SECRET?.replace(/^["']|["']$/g, '');
  if (!secret) {
    throw new Error(
      'AVITO_CLIENT_SECRET not found. Set it in .env file:\n' +
      '  AVITO_CLIENT_SECRET="your_client_secret"\n' +
      'Get credentials at https://developers.avito.ru/'
    );
  }
  return secret;
}

async function fetchNewToken(): Promise<TokenData> {
  const clientId = getClientId();
  const clientSecret = getClientSecret();

  const response = await fetch(`${API_BASE_URL}/token/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Avito OAuth Error ${response.status}: ${text}`);
  }

  const data = await response.json() as {
    access_token: string;
    token_type: string;
    expires_in: number;
  };

  return {
    accessToken: data.access_token,
    // Refresh 5 minutes before actual expiry
    expiresAt: Date.now() + (data.expires_in - 300) * 1000,
  };
}

async function getAccessToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt) {
    return cachedToken.accessToken;
  }
  cachedToken = await fetchNewToken();
  return cachedToken.accessToken;
}

function invalidateToken(): void {
  cachedToken = null;
}

// --- User ID Cache ---

let cachedUserId: number | null = null;

export async function getUserId(): Promise<number> {
  if (cachedUserId) return cachedUserId;

  const data = await fetchAvito<{ id: number }>('/core/v1/accounts/self');
  cachedUserId = data.id;
  return cachedUserId;
}

// --- Unified Fetch Helper ---

export async function fetchAvito<T>(
  endpoint: string,
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET',
  body?: unknown,
  retry = true,
): Promise<T> {
  const token = await getAccessToken();
  const url = `${API_BASE_URL}${endpoint}`;

  const headers: Record<string, string> = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  };

  const options: RequestInit = { method, headers };

  if (body && (method === 'POST' || method === 'PUT')) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(url, options);

  // Avito returns 403 on expired tokens (not 401)
  if (response.status === 403 && retry) {
    invalidateToken();
    return fetchAvito<T>(endpoint, method, body, false);
  }

  if (!response.ok) {
    const errorText = await response.text();
    let errorMessage = `Avito API Error ${response.status}: ${response.statusText}`;

    try {
      const errorJson = JSON.parse(errorText);
      if (errorJson.error?.message) {
        errorMessage = `Avito API: ${errorJson.error.message}`;
      } else if (errorJson.message) {
        errorMessage = `Avito API: ${errorJson.message}`;
      }
    } catch {
      if (errorText) errorMessage = errorText;
    }

    throw new Error(errorMessage);
  }

  if (response.status === 204) {
    return {} as T;
  }

  return response.json() as Promise<T>;
}
