/**
 * Simple logger for MCP operations
 * Logs to stderr to avoid interfering with MCP stdio protocol
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const currentLevel: LogLevel = (process.env.LOG_LEVEL as LogLevel) || 'info';

function log(level: LogLevel, message: string, meta?: Record<string, unknown>): void {
  if (LOG_LEVELS[level] < LOG_LEVELS[currentLevel]) {
    return;
  }

  const timestamp = new Date().toISOString();
  const metaStr = meta ? ` ${JSON.stringify(meta)}` : '';
  console.error(`[${timestamp}] [${level.toUpperCase()}] ${message}${metaStr}`);
}

export function debug(message: string, meta?: Record<string, unknown>): void {
  log('debug', message, meta);
}

export function info(message: string, meta?: Record<string, unknown>): void {
  log('info', message, meta);
}

export function warn(message: string, meta?: Record<string, unknown>): void {
  log('warn', message, meta);
}

export function error(message: string, meta?: Record<string, unknown>): void {
  log('error', message, meta);
}

/**
 * Log a read operation
 */
export async function logRead(
  toolName: string,
  resource: string,
  input: Record<string, unknown>,
  result: Record<string, unknown>
): Promise<void> {
  info(`[READ] ${toolName}`, {
    resource,
    input,
    ...result,
  });
}

/**
 * Log a write operation with preview
 */
export async function logWriteWithPreview(
  toolName: string,
  resource: string,
  input: Record<string, unknown>,
  preview: Record<string, unknown>
): Promise<void> {
  info(`[WRITE:PREVIEW] ${toolName}`, {
    resource,
    input,
    preview,
  });
}

/**
 * Log a confirmed write operation
 */
export async function logWriteConfirmed(
  toolName: string,
  resource: string,
  input: Record<string, unknown>,
  result: Record<string, unknown>,
  preview: Record<string, unknown>
): Promise<void> {
  info(`[WRITE:CONFIRMED] ${toolName}`, {
    resource,
    input,
    result,
    preview,
  });
}

/**
 * Log an error
 */
export async function logError(
  toolName: string,
  resource: string,
  input: Record<string, unknown>,
  err: Error
): Promise<void> {
  error(`[ERROR] ${toolName}`, {
    resource,
    input,
    error: err.message,
    stack: err.stack,
  });
}
