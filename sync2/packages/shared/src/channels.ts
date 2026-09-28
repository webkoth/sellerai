/** Площадки синка. WB — мастер остатка до перехода на finstock (решение 25.09.2026). */
export const CHANNELS = ["wb", "ozon", "ym", "kit", "site"] as const
export type Channel = (typeof CHANNELS)[number]

export const CHANNEL_TITLES: Record<Channel, string> = {
  wb: "Wildberries",
  ozon: "Ozon",
  ym: "Яндекс.Маркет",
  kit: "Яндекс KIT",
  site: "kotelnikovartifact.ru",
}

/** Короткие подписи площадок для уведомлений, ошибок прогонов и сводок (этап 1.4). */
export const CHANNEL_LABELS: Record<Channel, string> = { wb: "WB", ozon: "Ozon", ym: "ЯМ", kit: "KIT", site: "сайт" }

export function isChannel(value: string): value is Channel {
  return (CHANNELS as readonly string[]).includes(value)
}

/**
 * Режим записи на площадки, по возрастанию опасности.
 * off — не отправлять и не делать вид; dry-run — посчитать и записать в журнал,
 * что было бы отправлено; apply — отправить.
 */
export const WRITE_MODES = ["off", "dry-run", "apply"] as const
export type WriteMode = (typeof WRITE_MODES)[number]

/**
 * Разбор режима из окружения. Опечатка — ошибка: молча превратить "aply" в off
 * значит оставить владельца в уверенности, что запись идёт.
 */
export function parseWriteMode(raw: string | undefined, fallback: WriteMode): WriteMode {
  const value = (raw ?? "").trim().toLowerCase()
  if (value === "") return fallback
  if ((WRITE_MODES as readonly string[]).includes(value)) return value as WriteMode
  throw new RangeError(`неизвестный режим записи: "${raw}" (ожидается ${WRITE_MODES.join(" | ")})`)
}
