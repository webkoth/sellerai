import { Injectable, LoggerService, Scope } from '@nestjs/common';

export enum LogLevel {
  ERROR = 'error',
  WARN = 'warn',
  INFO = 'info',
  DEBUG = 'debug',
  VERBOSE = 'verbose',
}

export interface LogContext {
  // Request context
  requestId?: string;
  userId?: string;
  organizationId?: string;

  // Operation context
  operation?: string;
  marketplace?: string;
  marketplaceAccountId?: string;

  // Sync context
  syncJobId?: string;
  productId?: string;
  orderId?: string;

  // Performance
  duration?: number;
  itemCount?: number;

  // Custom fields
  [key: string]: unknown;
}

export interface StructuredLogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  service: string;
  context?: LogContext;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
}

@Injectable({ scope: Scope.TRANSIENT })
export class StructuredLogger implements LoggerService {
  private serviceName = 'hubmarket';
  private context: LogContext = {};
  private contextName = '';

  /**
   * Set the service/module name for this logger instance
   */
  setContext(name: string): this {
    this.contextName = name;
    return this;
  }

  /**
   * Set persistent context that will be included in all logs
   */
  setLogContext(context: LogContext): this {
    this.context = { ...this.context, ...context };
    return this;
  }

  /**
   * Clear persistent context
   */
  clearContext(): this {
    this.context = {};
    return this;
  }

  /**
   * Log an error message
   */
  error(message: string, traceOrContext?: string | LogContext, context?: LogContext): void {
    let errorInfo: { name: string; message: string; stack?: string } | undefined;
    let logContext = context;

    if (typeof traceOrContext === 'string') {
      errorInfo = {
        name: 'Error',
        message: traceOrContext,
        stack: traceOrContext,
      };
    } else if (traceOrContext) {
      logContext = traceOrContext;
    }

    this.writeLog(LogLevel.ERROR, message, logContext, errorInfo);
  }

  /**
   * Log a warning message
   */
  warn(message: string, context?: LogContext): void {
    this.writeLog(LogLevel.WARN, message, context);
  }

  /**
   * Log an info message
   */
  log(message: string, context?: LogContext): void {
    this.writeLog(LogLevel.INFO, message, context);
  }

  /**
   * Log a debug message
   */
  debug(message: string, context?: LogContext): void {
    if (process.env.NODE_ENV === 'production' && process.env.LOG_LEVEL !== 'debug') {
      return;
    }
    this.writeLog(LogLevel.DEBUG, message, context);
  }

  /**
   * Log a verbose message
   */
  verbose(message: string, context?: LogContext): void {
    if (process.env.NODE_ENV === 'production' && process.env.LOG_LEVEL !== 'verbose') {
      return;
    }
    this.writeLog(LogLevel.VERBOSE, message, context);
  }

  /**
   * Log with error object
   */
  errorWithException(message: string, error: Error, context?: LogContext): void {
    this.writeLog(LogLevel.ERROR, message, context, {
      name: error.name,
      message: error.message,
      stack: error.stack,
    });
  }

  /**
   * Log sync operation start
   */
  logSyncStart(
    operation: string,
    marketplace: string,
    context?: Partial<LogContext>,
  ): void {
    this.log(`Starting ${operation}`, {
      operation,
      marketplace,
      ...context,
    });
  }

  /**
   * Log sync operation complete
   */
  logSyncComplete(
    operation: string,
    marketplace: string,
    result: { success: number; failed: number; duration: number },
    context?: Partial<LogContext>,
  ): void {
    this.log(`Completed ${operation}`, {
      operation,
      marketplace,
      duration: result.duration,
      itemCount: result.success + result.failed,
      successCount: result.success,
      failedCount: result.failed,
      ...context,
    });
  }

  /**
   * Log API call
   */
  logApiCall(
    method: string,
    endpoint: string,
    statusCode: number,
    duration: number,
    context?: Partial<LogContext>,
  ): void {
    const level = statusCode >= 400 ? LogLevel.WARN : LogLevel.DEBUG;
    this.writeLog(level, `${method} ${endpoint} - ${statusCode}`, {
      httpMethod: method,
      endpoint,
      statusCode,
      duration,
      ...context,
    });
  }

  /**
   * Log marketplace API call
   */
  logMarketplaceApi(
    marketplace: string,
    operation: string,
    success: boolean,
    duration: number,
    context?: Partial<LogContext>,
  ): void {
    const level = success ? LogLevel.DEBUG : LogLevel.WARN;
    this.writeLog(level, `[${marketplace}] ${operation} - ${success ? 'OK' : 'FAILED'}`, {
      marketplace,
      operation,
      success,
      duration,
      ...context,
    });
  }

  private writeLog(
    level: LogLevel,
    message: string,
    context?: LogContext,
    error?: { name: string; message: string; stack?: string },
  ): void {
    const entry: StructuredLogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      service: this.contextName || this.serviceName,
      context: { ...this.context, ...context },
      ...(error && { error }),
    };

    // In production, output JSON
    if (process.env.NODE_ENV === 'production') {
      console.log(JSON.stringify(entry));
    } else {
      // In development, output human-readable format
      this.writeHumanReadable(entry);
    }
  }

  private writeHumanReadable(entry: StructuredLogEntry): void {
    const levelColors: Record<LogLevel, string> = {
      [LogLevel.ERROR]: '\x1b[31m', // Red
      [LogLevel.WARN]: '\x1b[33m',  // Yellow
      [LogLevel.INFO]: '\x1b[32m',  // Green
      [LogLevel.DEBUG]: '\x1b[36m', // Cyan
      [LogLevel.VERBOSE]: '\x1b[35m', // Magenta
    };

    const reset = '\x1b[0m';
    const color = levelColors[entry.level] || '';

    const contextStr = entry.context && Object.keys(entry.context).length > 0
      ? ` ${JSON.stringify(entry.context)}`
      : '';

    const errorStr = entry.error
      ? `\n  Error: ${entry.error.message}${entry.error.stack ? '\n  ' + entry.error.stack : ''}`
      : '';

    const time = entry.timestamp.split('T')[1].split('.')[0];

    console.log(
      `${color}[${time}] [${entry.level.toUpperCase().padEnd(5)}]${reset} ` +
      `[${entry.service}] ${entry.message}${contextStr}${errorStr}`,
    );
  }
}

/**
 * Create a child logger with specific context
 */
export function createLogger(name: string, context?: LogContext): StructuredLogger {
  const logger = new StructuredLogger();
  logger.setContext(name);
  if (context) {
    logger.setLogContext(context);
  }
  return logger;
}
