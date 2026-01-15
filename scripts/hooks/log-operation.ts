#!/usr/bin/env npx ts-node
/**
 * PostToolUse Hook: Логирование операций изменения данных на маркетплейсах
 *
 * Логирует все операции update_* в файл logs/operations.log
 * Формат: [timestamp] [marketplace] [operation] [details]
 */

import * as fs from 'fs';
import * as path from 'path';
import {
  PostToolUseInput,
  PostToolUseOutput,
  readInput,
  writeOutput,
} from './types';

const LOG_DIR = path.join(process.cwd(), 'logs');
const LOG_FILE = path.join(LOG_DIR, 'operations.log');

interface OperationLogEntry {
  timestamp: string;
  marketplace: string;
  operation: string;
  input: Record<string, unknown>;
  success: boolean;
  result?: string;
}

function getMarketplace(toolName: string): string {
  if (toolName.includes('wb-mcp')) return 'WB';
  if (toolName.includes('ozon-mcp')) return 'Ozon';
  if (toolName.includes('ym-mcp')) return 'YM';
  return 'Unknown';
}

function getOperation(toolName: string): string {
  const parts = toolName.split('__');
  return parts[parts.length - 1] || toolName;
}

function isSuccessResult(result: string | Record<string, unknown>): boolean {
  if (typeof result === 'string') {
    // Проверяем наличие ошибок в результате
    const lowerResult = result.toLowerCase();
    return !lowerResult.includes('error') && !lowerResult.includes('failed') && !lowerResult.includes('ошибка');
  }
  // Для объектов проверяем поле success или error
  if (typeof result === 'object' && result !== null) {
    if ('error' in result) return false;
    if ('success' in result) return Boolean(result.success);
  }
  return true;
}

function formatLogEntry(entry: OperationLogEntry): string {
  const status = entry.success ? 'SUCCESS' : 'FAILED';
  const inputStr = JSON.stringify(entry.input);
  return `[${entry.timestamp}] [${entry.marketplace}] [${entry.operation}] [${status}] ${inputStr}`;
}

function appendLog(entry: OperationLogEntry): void {
  // Создаём директорию если не существует
  if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
  }

  const logLine = formatLogEntry(entry) + '\n';
  fs.appendFileSync(LOG_FILE, logLine, 'utf-8');
}

function main(): void {
  try {
    const input = readInput<PostToolUseInput>();

    // Логируем только операции с confirm=true (реальные изменения)
    const toolInput = input.tool_input as Record<string, unknown>;
    if (toolInput.confirm !== true) {
      // Preview режим - не логируем
      writeOutput({});
      return;
    }

    const entry: OperationLogEntry = {
      timestamp: new Date().toISOString(),
      marketplace: getMarketplace(input.tool_name),
      operation: getOperation(input.tool_name),
      input: toolInput,
      success: isSuccessResult(input.tool_result),
    };

    appendLog(entry);

    // Возвращаем systemMessage только для неуспешных операций
    if (!entry.success) {
      writeOutput({
        systemMessage: `Операция ${entry.operation} на ${entry.marketplace} завершилась с ошибкой. Проверь логи: ${LOG_FILE}`,
      });
    } else {
      writeOutput({});
    }
  } catch (error) {
    // Ошибка логирования не должна блокировать работу
    writeOutput({});
  }
}

main();
