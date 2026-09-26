/**
 * Текст ошибки для журнала и логов: причина, а не просто "[object Object]" или
 * голый [Error]. Единая точка — раньше жила приватно в @sync2/platforms/writer.
 */
export function errorText(e: unknown): string {
  return e instanceof Error
    ? [e.message, e.cause instanceof Error ? e.cause.message : null].filter(Boolean).join(": ") || e.name
    : typeof e === "object" && e !== null
      ? safeJson(e)
      : String(e)
}

/** JSON.stringify падает на циклических объектах — тогда лучше String(e), чем упасть самим. */
function safeJson(e: object): string {
  try {
    return JSON.stringify(e)
  } catch {
    return String(e)
  }
}
