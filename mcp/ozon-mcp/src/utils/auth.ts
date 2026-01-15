import { config } from 'dotenv';
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';

// Load .env from project root
const projectRoot = join(dirname(import.meta.url.replace('file://', '')), '../../../../');
config({ path: join(projectRoot, '.env') });

export interface OzonCredentials {
  clientId: string;
  apiKey: string;
}

/**
 * Get Ozon API credentials from environment or file
 * Priority: .env > ~/.ozon_credentials > environment variables
 */
export function getOzonCredentials(): OzonCredentials {
  // 1. Try .env file (already loaded)
  const clientId = process.env.OZON_CLIENT_ID?.replace(/^["']|["']$/g, '');
  const apiKey = process.env.OZON_API_TOKEN?.replace(/^["']|["']$/g, '');

  if (clientId && apiKey) {
    return { clientId, apiKey };
  }

  // 2. Try ~/.ozon_credentials (JSON format)
  const homeCredentialsPath = join(process.env.HOME || '', '.ozon_credentials');
  if (existsSync(homeCredentialsPath)) {
    try {
      const content = readFileSync(homeCredentialsPath, 'utf-8').trim();
      const parsed = JSON.parse(content);
      if (parsed.clientId && parsed.apiKey) {
        return {
          clientId: parsed.clientId,
          apiKey: parsed.apiKey,
        };
      }
    } catch {
      // Invalid JSON, continue to next option
    }
  }

  // 3. Try ~/.config/ozon/credentials
  const configCredentialsPath = join(process.env.HOME || '', '.config', 'ozon', 'credentials');
  if (existsSync(configCredentialsPath)) {
    try {
      const content = readFileSync(configCredentialsPath, 'utf-8').trim();
      const parsed = JSON.parse(content);
      if (parsed.clientId && parsed.apiKey) {
        return {
          clientId: parsed.clientId,
          apiKey: parsed.apiKey,
        };
      }
    } catch {
      // Invalid JSON
    }
  }

  throw new Error(
    'Ozon credentials not found. Please set them in:\n' +
    '  1. .env file (OZON_CLIENT_ID="..." and OZON_API_TOKEN="...")\n' +
    '  2. ~/.ozon_credentials (JSON: {"clientId": "...", "apiKey": "..."})\n' +
    '  3. Environment variables OZON_CLIENT_ID and OZON_API_TOKEN'
  );
}

/**
 * Get database connection string
 */
export function getDatabaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) {
    // Default local PostgreSQL
    return 'postgresql://localhost:5432/sellerai';
  }
  return url;
}

/**
 * Ozon API base URL
 * All Ozon Seller API endpoints use the same base URL
 */
export const OZON_API_URL = 'https://api-seller.ozon.ru';

/**
 * Rate limits for Ozon API
 * Standard tier: 300 requests per 60 seconds
 */
export const OZON_RATE_LIMITS = {
  requestsPerMinute: 300,
  requestInterval: 200, // ms between requests to stay safe
} as const;

/**
 * Create headers for Ozon API request
 */
export function createOzonHeaders(credentials?: OzonCredentials): Record<string, string> {
  const creds = credentials || getOzonCredentials();
  return {
    'Client-Id': creds.clientId,
    'Api-Key': creds.apiKey,
    'Content-Type': 'application/json',
  };
}
