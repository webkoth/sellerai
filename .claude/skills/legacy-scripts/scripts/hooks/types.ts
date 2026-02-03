/**
 * Типы для Claude Code Hooks
 * https://code.claude.com/docs/en/hooks
 */

// === Входные данные hooks ===

export interface PreToolUseInput {
  hook_event_name: 'PreToolUse';
  tool_name: string;
  tool_input: Record<string, unknown>;
  tool_use_id: string;
  session_id: string;
  cwd: string;
}

export interface PostToolUseInput {
  hook_event_name: 'PostToolUse';
  tool_name: string;
  tool_input: Record<string, unknown>;
  tool_result: string | Record<string, unknown>;
  tool_use_id: string;
  session_id: string;
  cwd: string;
}

export interface SessionStartInput {
  hook_event_name: 'SessionStart';
  session_id: string;
  cwd: string;
}

export type HookInput = PreToolUseInput | PostToolUseInput | SessionStartInput;

// === Выходные данные hooks ===

export interface AllowDecision {
  decision: 'allow';
  updatedInput?: Record<string, unknown>; // Можно модифицировать input
}

export interface DenyDecision {
  decision: 'deny';
  reason: string;
}

export interface AskDecision {
  decision: 'ask';
  message?: string;
}

export type PreToolUseOutput = AllowDecision | DenyDecision | AskDecision;

export interface PostToolUseOutput {
  systemMessage?: string; // Сообщение для Claude
}

export interface SessionStartOutput {
  systemMessage?: string; // Сообщение при старте сессии
}

// === Специфичные типы для маркетплейсов ===

export interface WbUpdatePriceInput {
  nmId: number;
  price?: number;
  discount?: number;
  confirm?: boolean;
}

export interface OzonUpdatePriceInput {
  offerId: string;
  price?: string;
  oldPrice?: string;
  premiumPrice?: string;
  confirm?: boolean;
}

export interface UpdateStocksInput {
  stocks: Array<{
    offerId?: string;
    warehouseId: number;
    stock: number;
  }>;
  confirm?: boolean;
}

// === Утилиты ===

export function readInput<T extends HookInput>(): T {
  const input = process.argv[2];
  if (!input) {
    throw new Error('No input provided to hook');
  }
  return JSON.parse(input) as T;
}

export function writeOutput(output: PreToolUseOutput | PostToolUseOutput | SessionStartOutput): void {
  console.log(JSON.stringify(output));
}

export function allowTool(updatedInput?: Record<string, unknown>): PreToolUseOutput {
  return updatedInput ? { decision: 'allow', updatedInput } : { decision: 'allow' };
}

export function denyTool(reason: string): PreToolUseOutput {
  return { decision: 'deny', reason };
}

export function askUser(message?: string): PreToolUseOutput {
  return message ? { decision: 'ask', message } : { decision: 'ask' };
}
