/** Сайт — служебный API (этап 1.3c); null — SITE_API_TOKEN не задан, сайт не подключается. */
export interface SiteChannelConfig {
  baseUrl: string
  token: string
}

export const DEFAULT_SITE_API_URL = "https://kotelnikovartifact.ru"
/** Тот же предел, что у INTERNAL_API_TOKEN на стороне сайта. */
const SITE_TOKEN_MIN_LENGTH = 32

/**
 * Ключи и склады площадок (сайт — необязательный, этап 1.3c) из окружения —
 * для адаптеров чтения (`@sync2/platforms`), не для `Config`/`loadConfig`
 * (`@sync2/shared`): там только БД и режим записи, здесь — учётные данные,
 * которые `probe` читает без базы вовсе (план 1.3a, задача 7).
 *
 * Функция чистая: окружение — параметр, а не `process.env`, тестируется без
 * побочных эффектов.
 *
 * ЯМ: `businessId`/`campaignId` — строки, как того ждёт `YmCredentials`
 * (`@sync2/platforms/ym/client.ts`) — плановая правка «Поправки при
 * исполнении»: исходный план ждал числа, но адаптер принимает строки.
 */
export interface ChannelsConfig {
  /** warehouseId — склад записи остатка (этап 1.4); null — запись этой площадки невозможна, чтение работает. */
  wb: { token: string; warehouseId: number | null }
  /** warehouseId — склад записи остатка FBS (этап 1.4); null — запись этой площадки невозможна, чтение работает. */
  ozon: { clientId: string; apiKey: string; warehouseId: number | null }
  ym: { apiKey: string; businessId: string; campaignId: string; warehouseIds: number[] }
  kit: { token: string; warehouseId: string }
  site: SiteChannelConfig | null
  /**
   * Конфиг сайта задан, но битый (не URL, http, короткий токен): сайт пропускается,
   * текст — здесь. Сайт необязателен, и его ошибка не роняет ingest обязательных
   * площадок — ingest уходит в partial с этим текстом.
   */
  siteError: string | null
}

function required(env: Record<string, string | undefined>, name: string): string {
  const value = env[name]?.trim()
  if (!value) throw new Error(`${name} не задан`)
  return value
}

/**
 * Список складов ЯМ через запятую — непустой список положительных целых
 * (у KIT и WB склад/токен всегда один, отдельного разбора не требуют).
 * Пустой список после разбора (например, одна запятая), не-число, ноль,
 * отрицательное или дробное значение — ошибка с именем переменной: тихая
 * подстановка `NaN`/пустого списка означала бы читать несуществующий склад
 * или не читать ни одного молча.
 */
function requiredWarehouseIds(env: Record<string, string | undefined>, name: string): number[] {
  const parts = required(env, name)
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
  const ids = parts.map((part) => {
    const n = Number(part)
    if (!Number.isInteger(n) || n <= 0) throw new Error(`${name}: "${part}" — не целое положительное число`)
    return n
  })
  if (ids.length === 0) throw new Error(`${name} не задан`)
  return ids
}

/**
 * Сайт подключается, только если задан SITE_API_TOKEN (= INTERNAL_API_TOKEN
 * сайта). Токен уходит в заголовке, поэтому адрес — только https (кроме
 * localhost для разработки); короткий токен — ошибка, а не тихое отключение
 * (её ловит loadChannelsConfig и кладёт в siteError).
 */
function optionalSite(env: Record<string, string | undefined>): SiteChannelConfig | null {
  const token = env.SITE_API_TOKEN?.trim()
  if (!token) return null
  if (token.length < SITE_TOKEN_MIN_LENGTH) throw new Error(`SITE_API_TOKEN короче ${SITE_TOKEN_MIN_LENGTH} символов`)
  const raw = env.SITE_API_URL?.trim() || DEFAULT_SITE_API_URL
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    throw new Error(`SITE_API_URL: "${raw}" — не URL`)
  }
  const local = url.hostname === "localhost" || url.hostname === "127.0.0.1"
  if (url.protocol !== "https:" && !local) throw new Error(`SITE_API_URL: только https (кроме localhost), получено ${url.protocol}`)
  return { baseUrl: `${url.origin}${url.pathname}`.replace(/\/+$/, ""), token }
}

/** Необязательное целое положительное (склады записи WB/Ozon, этап 1.4): пусто — null, мусор — ошибка с именем. */
function optionalPositiveInt(env: Record<string, string | undefined>, name: string): number | null {
  const raw = env[name]?.trim()
  if (!raw) return null
  const n = Number(raw)
  if (!Number.isSafeInteger(n) || n <= 0) throw new Error(`${name}: "${raw}" — не целое положительное число`)
  return n
}

export function loadChannelsConfig(env: Record<string, string | undefined>): ChannelsConfig {
  let site: SiteChannelConfig | null = null
  let siteError: string | null = null
  try {
    site = optionalSite(env)
  } catch (e) {
    siteError = e instanceof Error ? e.message : String(e)
  }
  return {
    wb: { token: required(env, "WB_API_TOKEN"), warehouseId: optionalPositiveInt(env, "WB_WAREHOUSE_ID") },
    ozon: {
      clientId: required(env, "OZON_CLIENT_ID"),
      apiKey: required(env, "OZON_API_TOKEN"),
      warehouseId: optionalPositiveInt(env, "OZON_WAREHOUSE_ID"),
    },
    ym: {
      apiKey: required(env, "YM_API_TOKEN"),
      businessId: required(env, "YM_BUSINESS_ID"),
      campaignId: required(env, "YM_CAMPAIGN_ID"),
      warehouseIds: requiredWarehouseIds(env, "YM_WAREHOUSE_IDS"),
    },
    kit: { token: required(env, "YAKIT_API_TOKEN"), warehouseId: required(env, "KIT_WAREHOUSE_ID") },
    site,
    siteError,
  }
}
