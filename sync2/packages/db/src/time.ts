/**
 * timestamptz в режиме string приходит из Postgres текстом («2026-09-26 11:15:54.405+00»),
 * а домен сравнивает и хранит ISO 8601. Нормализуем на выходе из хранилища — один раз.
 * Точность — миллисекунды: микросекунды Postgres домену не нужны.
 */
export function toIso(value: string): string {
  const ms = Date.parse(value.includes("T") ? value : value.replace(" ", "T").replace(/([+-]\d{2})$/, "$1:00"))
  if (Number.isNaN(ms)) throw new RangeError(`не время: "${value}"`)
  return new Date(ms).toISOString()
}

export function toIsoOrNull(value: string | null): string | null {
  return value === null ? null : toIso(value)
}
