export interface Notifier {
  /** true — доставлено; false — не отправлялось или Telegram отказал (джоба не падает). */
  send(text: string): Promise<boolean>
}

export function createNotifier(opts: { token: string; chatId: string; fetchImpl?: typeof fetch }): Notifier {
  const f = opts.fetchImpl ?? fetch
  return {
    async send(text) {
      if (!opts.token || !opts.chatId) return false
      try {
        const r = await f(`https://api.telegram.org/bot${opts.token}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chat_id: opts.chatId, text, disable_web_page_preview: true }),
          signal: AbortSignal.timeout(15_000),
        })
        return r.ok
      } catch {
        return false
      }
    },
  }
}
