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
 * Log a tool operation.
 *
 * Ранее писало в Postgres (operations_log). БД выведена из проекта,
 * поэтому read-логирование — no-op, а ошибки уходят в stderr (виден в логах MCP).
 * Сигнатуры функций сохранены, чтобы не трогать места вызова в инструментах.
 */
export async function log(_params: LogParams): Promise<void> {
  // no-op
}

/**
 * Log a successful read operation
 */
export async function logRead(
  _toolName: string,
  _domain: string,
  _params?: Record<string, unknown>,
  _result?: Record<string, unknown>
): Promise<void> {
  // no-op
}

/**
 * Log a write operation with preview
 */
export async function logWriteWithPreview(
  _toolName: string,
  _domain: string,
  _params: Record<string, unknown>,
  _preview: Record<string, unknown>
): Promise<void> {
  // no-op
}

/**
 * Log a confirmed write operation
 */
export async function logWriteConfirmed(
  _toolName: string,
  _domain: string,
  _params: Record<string, unknown>,
  _result: Record<string, unknown>,
  _preview: Record<string, unknown>
): Promise<void> {
  // no-op
}

/**
 * Log an error (to stderr — safe for stdio MCP transport)
 */
export async function logError(
  toolName: string,
  domain: string,
  _params: Record<string, unknown>,
  error: Error
): Promise<void> {
  console.error(`[${domain}] ${toolName} failed: ${error.message}`);
}
