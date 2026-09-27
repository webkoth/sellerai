/**
 * Ключи и склады четырёх площадок из окружения — для адаптеров чтения
 * (`@sync2/platforms`), не для `Config`/`loadConfig` (`@sync2/shared`): там
 * только БД и режим записи, здесь — учётные данные, которые `probe` читает
 * без базы вовсе (план 1.3a, задача 7).
 *
 * Функция чистая: окружение — параметр, а не `process.env`, тестируется без
 * побочных эффектов.
 *
 * ЯМ: `businessId`/`campaignId` — строки, как того ждёт `YmCredentials`
 * (`@sync2/platforms/ym/client.ts`) — плановая правка «Поправки при
 * исполнении»: исходный план ждал числа, но адаптер принимает строки.
 */
export interface ChannelsConfig {
  wb: { token: string }
  ozon: { clientId: string; apiKey: string }
  ym: { apiKey: string; businessId: string; campaignId: string; warehouseIds: number[] }
  kit: { token: string; warehouseId: string }
}

function required(env: Record<string, string | undefined>, name: string): string {
  const value = env[name]?.trim()
  if (!value) throw new Error(`${name} не задан`)
  return value
}

/** Список чисел через запятую — склады ЯМ (у KIT и WB склад/токен всегда один). */
function requiredNumberList(env: Record<string, string | undefined>, name: string): number[] {
  return required(env, name)
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
    .map(Number)
}

export function loadChannelsConfig(env: Record<string, string | undefined>): ChannelsConfig {
  return {
    wb: { token: required(env, "WB_API_TOKEN") },
    ozon: { clientId: required(env, "OZON_CLIENT_ID"), apiKey: required(env, "OZON_API_TOKEN") },
    ym: {
      apiKey: required(env, "YM_API_TOKEN"),
      businessId: required(env, "YM_BUSINESS_ID"),
      campaignId: required(env, "YM_CAMPAIGN_ID"),
      warehouseIds: requiredNumberList(env, "YM_WAREHOUSE_IDS"),
    },
    kit: { token: required(env, "YAKIT_API_TOKEN"), warehouseId: required(env, "KIT_WAREHOUSE_ID") },
  }
}
