import { describe, expect, it, vi } from "vitest"
import { createNotifier } from "./notify"

describe("createNotifier", () => {
  it("шлёт текст в чат через Bot API", async () => {
    const f = vi.fn(async (_url: string | URL | Request, _init?: RequestInit) => new Response('{"ok":true}', { status: 200 }))
    await createNotifier({ token: "T", chatId: "-100", fetchImpl: f }).send("привет")
    const [url, init] = f.mock.calls[0]!
    expect(url).toBe("https://api.telegram.org/botT/sendMessage")
    expect(JSON.parse(String(init?.body))).toEqual({ chat_id: "-100", text: "привет", disable_web_page_preview: true })
  })
  it("без токена — ничего не шлёт и не падает", async () => {
    const f = vi.fn()
    await createNotifier({ token: "", chatId: "-100", fetchImpl: f }).send("x")
    expect(f).not.toHaveBeenCalled()
  })
  it("ошибка Telegram не роняет джобу — возвращает false", async () => {
    const f = vi.fn(async () => new Response("bad", { status: 400 }))
    await expect(createNotifier({ token: "T", chatId: "-100", fetchImpl: f }).send("x")).resolves.toBe(false)
  })
})
