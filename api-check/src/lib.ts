/**
 * Общая библиотека для проверок API маркетплейсов.
 *
 * Цель — быстро увидеть две вещи по каждому эндпоинту:
 *   1) живой ли API (HTTP-код, время ответа, сетевые ошибки),
 *   2) какие данные приходят (кол-во записей + пример).
 *
 * Никаких изменяющих операций — только чтение (GET / list-POST).
 */

import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

// ---------------------------------------------------------------------------
// .env
// ---------------------------------------------------------------------------

/** Загрузить .env из корня проекта (на уровень выше этого приложения). */
export function loadEnv(): string | null {
  const here = dirname(fileURLToPath(import.meta.url)); // api-check/src
  const candidates = [
    join(here, '..', '..', '.env'), // <корень проекта>/.env
    join(here, '..', '.env'), // api-check/.env (на случай локального)
    join(process.cwd(), '.env'),
  ];
  for (const p of candidates) {
    if (existsSync(p)) {
      try {
        process.loadEnvFile(p);
        return p;
      } catch {
        /* пробуем следующий */
      }
    }
  }
  return null;
}

/** Прочитать переменную окружения, сняв обрамляющие кавычки. */
export function env(name: string): string | undefined {
  const v = process.env[name];
  if (v == null) return undefined;
  return v.replace(/^["']|["']$/g, '').trim();
}

/** Обязательная переменная окружения — иначе понятная ошибка. */
export function requireEnv(name: string): string {
  const v = env(name);
  if (!v) throw new Error(`не задан ${name} в .env`);
  return v;
}

// ---------------------------------------------------------------------------
// Цвета (без зависимостей)
// ---------------------------------------------------------------------------

const useColor = process.stdout.isTTY && !process.env.NO_COLOR;
const paint = (code: string) => (s: string) => (useColor ? `\x1b[${code}m${s}\x1b[0m` : s);

export const c = {
  green: paint('32'),
  red: paint('31'),
  yellow: paint('33'),
  cyan: paint('36'),
  gray: paint('90'),
  bold: paint('1'),
  dim: paint('2'),
};

// ---------------------------------------------------------------------------
// Прокси (опционально)
// ---------------------------------------------------------------------------

/**
 * Если задан ALL_PROXY / HTTPS_PROXY / API_CHECK_PROXY — направить весь fetch
 * через него. Нужно, когда РФ-API гео-заблокированы и доступны только через
 * VPS-relay (SOCKS5-туннель), см. README. Без переменной — обычный прямой fetch.
 *
 * Поддержка:
 *   socks5://[user:pass@]host:port  — через пакет `socks`
 *   http(s)://[user:pass@]host:port — через undici ProxyAgent
 *
 * undici/socks подгружаются лениво — если прокси не нужен, они и не требуются.
 */
export async function installProxy(): Promise<string | null> {
  const raw = env('ALL_PROXY') || env('HTTPS_PROXY') || env('API_CHECK_PROXY');
  if (!raw) return null;

  let undici: any;
  try {
    undici = await import('undici');
  } catch {
    throw new Error(`для прокси нужен пакет undici (npm i undici). Прокси: ${raw}`);
  }

  if (/^socks/i.test(raw)) {
    let socks: any;
    try {
      socks = await import('socks');
    } catch {
      throw new Error('для SOCKS-прокси нужен пакет socks (npm i socks)');
    }
    const u = new URL(raw);
    const proxy = {
      host: u.hostname,
      port: Number(u.port) || 1080,
      type: /socks4/i.test(u.protocol) ? (4 as const) : (5 as const),
      ...(u.username ? { userId: decodeURIComponent(u.username) } : {}),
      ...(u.password ? { password: decodeURIComponent(u.password) } : {}),
    };
    const connect = undici.buildConnector({ timeout: 15_000 });
    const agent = new undici.Agent({
      connect: async (opts: any, cb: any) => {
        try {
          const { socket } = await socks.SocksClient.createConnection({
            proxy,
            command: 'connect',
            destination: { host: opts.hostname, port: Number(opts.port) || 443 },
          });
          connect({ ...opts, httpSocket: socket }, cb);
        } catch (err) {
          cb(err, null);
        }
      },
    });
    undici.setGlobalDispatcher(agent);
  } else {
    undici.setGlobalDispatcher(new undici.ProxyAgent(raw));
  }
  return raw;
}

// ---------------------------------------------------------------------------
// HTTP
// ---------------------------------------------------------------------------

export interface HttpResult {
  ok: boolean;
  status: number;
  statusText: string;
  ms: number;
  body: any;
  isJson: boolean;
  error?: string;
}

export interface HttpOptions {
  headers?: Record<string, string>;
  body?: unknown;
  timeoutMs?: number;
}

const DEFAULT_TIMEOUT = Number(env('API_CHECK_TIMEOUT_MS')) || 45_000;

/** fetch с таймингом, таймаутом и безопасным разбором тела. Никогда не бросает. */
export async function http(method: string, url: string, opts: HttpOptions = {}): Promise<HttpResult> {
  const { headers = {}, body, timeoutMs = DEFAULT_TIMEOUT } = opts;
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), timeoutMs);
  const started = performance.now();
  try {
    const res = await fetch(url, {
      method,
      headers: { Accept: 'application/json', ...headers },
      body: body == null ? undefined : typeof body === 'string' ? body : JSON.stringify(body),
      signal: ac.signal,
    });
    const ms = Math.round(performance.now() - started);
    const text = await res.text();
    let parsed: any = text;
    let isJson = false;
    try {
      parsed = text ? JSON.parse(text) : null;
      isJson = true;
    } catch {
      /* не JSON — оставляем текст */
    }
    return { ok: res.ok, status: res.status, statusText: res.statusText, ms, body: parsed, isJson };
  } catch (e: any) {
    const ms = Math.round(performance.now() - started);
    const error = e?.name === 'AbortError' ? `таймаут ${timeoutMs} мс` : e?.message || String(e);
    return { ok: false, status: 0, statusText: '', ms, body: null, isJson: false, error };
  } finally {
    clearTimeout(timer);
  }
}

// ---------------------------------------------------------------------------
// Модель пробы
// ---------------------------------------------------------------------------

export interface ProbeOutcome {
  http: HttpResult;
  /** Переопределить вердикт (например, 403 «нет подписки» = ожидаемо). */
  ok?: boolean;
  /** Кол-во записей в ответе. */
  count?: number;
  /** Пример данных (будет обрезан, если не --full). */
  sample?: unknown;
  /** Короткая ремарка (всего записей, причина и т.п.). */
  note?: string;
}

export interface ProbeDef {
  name: string;
  category: string;
  run: () => Promise<ProbeOutcome>;
}

export interface ProbeResult extends ProbeOutcome {
  name: string;
  category: string;
  ok: boolean;
}

// ---------------------------------------------------------------------------
// CLI-флаги
// ---------------------------------------------------------------------------

export interface Flags {
  full: boolean; // не обрезать примеры
  json: boolean; // печатать сырой JSON-ответ
  quiet: boolean; // только строки статусов, без примеров
  only?: string; // фильтр проб по подстроке (имя/категория)
}

export function parseFlags(argv: string[] = process.argv.slice(2)): Flags {
  const f: Flags = { full: false, json: false, quiet: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (a === '--full') f.full = true;
    else if (a === '--json') f.json = true;
    else if (a === '--quiet' || a === '-q') f.quiet = true;
    else if (a === '--only') f.only = argv[++i];
    else if (a.startsWith('--only=')) f.only = a.slice('--only='.length);
  }
  return f;
}

// ---------------------------------------------------------------------------
// Рендер
// ---------------------------------------------------------------------------

const len = (a: unknown): number | undefined => (Array.isArray(a) ? a.length : undefined);
export { len };

function statusLabel(r: HttpResult): string {
  if (r.error) return c.red('ERR');
  if (r.status >= 200 && r.status < 300) return c.green(String(r.status));
  if (r.status >= 400 && r.status < 500) return c.yellow(String(r.status));
  return c.red(String(r.status || '?'));
}

/** Глубокая обрезка примера: строки до 160 симв., массивы до 2 эл., объекты целиком. */
function truncate(v: any, full: boolean): any {
  if (full || v == null) return v;
  if (typeof v === 'string') return v.length > 160 ? v.slice(0, 160) + '…' : v;
  if (Array.isArray(v)) {
    const head = v.slice(0, 2).map((x) => truncate(x, full));
    return v.length > 2 ? [...head, `…(+${v.length - 2} ещё)`] : head;
  }
  if (typeof v === 'object') {
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(v)) out[k] = truncate(v[k], full);
    return out;
  }
  return v;
}

function indent(s: string, spaces: number): string {
  const pad = ' '.repeat(spaces);
  return s
    .split('\n')
    .map((l) => pad + l)
    .join('\n');
}

function printResult(r: ProbeResult, flags: Flags): void {
  const icon = r.ok ? c.green('✅') : c.red('❌');
  const cat = c.gray(`[${r.category.padEnd(11)}]`);
  const name = r.name.padEnd(26);
  const code = statusLabel(r.http);
  const ms = c.dim(`${String(r.http.ms).padStart(6)} мс`);
  const cnt = r.count != null ? c.cyan(`n=${r.count}`) : '';
  console.log(`${icon} ${cat} ${name} ${code.padStart(3)} ${ms}  ${cnt}`);

  if (r.http.error) console.log(indent(c.red('↳ ' + r.http.error), 3));
  else if (r.note) console.log(indent(c.gray('↳ ' + r.note), 3));

  if (flags.json) {
    console.log(indent(c.dim(JSON.stringify(r.http.body, null, 2)), 5));
    return;
  }
  if (flags.quiet) return;

  if (r.sample !== undefined) {
    console.log(indent(c.dim(JSON.stringify(truncate(r.sample, flags.full), null, 2)), 5));
  } else if (!r.ok && r.http.body != null) {
    // у неуспешной пробы показываем тело ошибки — это и есть «какие данные приходят»
    console.log(indent(c.dim(JSON.stringify(truncate(r.http.body, flags.full), null, 2)), 5));
  }
}

// ---------------------------------------------------------------------------
// Запуск набора
// ---------------------------------------------------------------------------

export async function runSuite(title: string, defs: ProbeDef[], flags: Flags): Promise<ProbeResult[]> {
  const filtered = flags.only
    ? defs.filter((d) => `${d.name} ${d.category}`.toLowerCase().includes(flags.only!.toLowerCase()))
    : defs;

  console.log('');
  console.log(c.bold(`━━━ ${title} ━━━  ${c.dim(`(${filtered.length} проб)`)}`));

  const results: ProbeResult[] = [];
  for (const d of filtered) {
    let result: ProbeResult;
    try {
      const out = await d.run();
      result = { ...out, name: d.name, category: d.category, ok: out.ok ?? out.http.ok };
    } catch (e: any) {
      result = {
        name: d.name,
        category: d.category,
        ok: false,
        http: { ok: false, status: 0, statusText: '', ms: 0, body: null, isJson: false, error: e?.message || String(e) },
      };
    }
    results.push(result);
    printResult(result, flags);
  }

  const ok = results.filter((r) => r.ok).length;
  const fail = results.length - ok;
  const verdict = fail === 0 ? c.green(`OK ${ok}/${results.length}`) : c.yellow(`OK ${ok}/${results.length}, ошибок: ${fail}`);
  console.log(c.dim(`итог ${title}: `) + verdict);
  return results;
}

/** Шапка прогона: версия Node, .env и активный прокси. */
export function printHeader(envPath: string | null, proxy?: string | null): void {
  const ts = new Date().toLocaleString('ru-RU');
  console.log(c.bold('🔌 Проверка API маркетплейсов'));
  console.log(c.dim(`   Node ${process.version} · ${ts}`));
  console.log(c.dim(`   .env: ${envPath ?? c.red('не найден!')}`));
  if (proxy) console.log(c.dim(`   proxy: ${maskProxy(proxy)}`));
}

/** Скрыть логин/пароль в URL прокси при выводе. */
function maskProxy(url: string): string {
  return url.replace(/\/\/[^@/]+@/, '//***@');
}

/** Установить код выхода по результатам (0 — всё ок, 1 — были ошибки). */
export function applyExitCode(all: ProbeResult[]): void {
  process.exitCode = all.some((r) => !r.ok) ? 1 : 0;
}

/** true, если файл запущен напрямую (а не импортирован). */
export function isMain(metaUrl: string): boolean {
  return !!process.argv[1] && metaUrl === pathToFileURL(process.argv[1]).href;
}
