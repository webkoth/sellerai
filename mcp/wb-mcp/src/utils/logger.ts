import { logOperation } from '../db/postgres.js';

export type Marketplace = 'wb' | 'ozon' | 'ym';

export interface LogParams {
  marketplace: Marketplace;
  domain: string;
  action: string;
  toolName: string;
  params?: Record<string, unknown>;
  result?: Record<string, unknown>;
  success: boolean;
  confirmedBy?: string;
  previewShown?: Record<string, unknown>;
}

/**
 * Log a tool operation
 */
export async function log(params: LogParams): Promise<void> {
  try {
    await logOperation(params);
  } catch (error) {
    console.error('Failed to log operation:', error);
  }
}

/**
 * Log a successful read operation
 */
export async function logRead(
  toolName: string,
  domain: string,
  params?: Record<string, unknown>,
  result?: Record<string, unknown>
): Promise<void> {
  await log({
    marketplace: 'wb',
    domain,
    action: 'read',
    toolName,
    params,
    result,
    success: true,
  });
}

/**
 * Log a write operation with preview
 */
export async function logWriteWithPreview(
  toolName: string,
  domain: string,
  params: Record<string, unknown>,
  preview: Record<string, unknown>
): Promise<void> {
  await log({
    marketplace: 'wb',
    domain,
    action: 'preview',
    toolName,
    params,
    success: true,
    previewShown: preview,
  });
}

/**
 * Log a confirmed write operation
 */
export async function logWriteConfirmed(
  toolName: string,
  domain: string,
  params: Record<string, unknown>,
  result: Record<string, unknown>,
  preview: Record<string, unknown>
): Promise<void> {
  await log({
    marketplace: 'wb',
    domain,
    action: 'write',
    toolName,
    params,
    result,
    success: true,
    confirmedBy: 'user',
    previewShown: preview,
  });
}

/**
 * Log an error
 */
export async function logError(
  toolName: string,
  domain: string,
  params: Record<string, unknown>,
  error: Error
): Promise<void> {
  await log({
    marketplace: 'wb',
    domain,
    action: 'error',
    toolName,
    params,
    result: { error: error.message },
    success: false,
  });
}
