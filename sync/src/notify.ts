/**
 * Telegram-алерты в группу KOTELNIKOVARTIFACT.
 * Токен — TELEGRAM_BOT_TOKEN (.env), chat_id — из sync-config.json.
 */
import { TELEGRAM_TOKEN, TELEGRAM_CHAT } from './config.js';
import { log } from './log.js';

const esc = (s: string): string => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Отправить сообщение. Возвращает true при успехе; никогда не бросает. */
export async function notify(text: string): Promise<boolean> {
  if (!TELEGRAM_TOKEN || TELEGRAM_CHAT === undefined) {
    log('[notify] нет TELEGRAM_BOT_TOKEN/chat_id — алерт пропущен');
    return false;
  }
  try {
    const r = await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        chat_id: TELEGRAM_CHAT,
        text,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
      }),
    });
    const j = (await r.json()) as { ok?: boolean; description?: string };
    if (!j.ok) log(`[notify] Telegram отклонил: ${j.description || 'unknown'}`);
    return !!j.ok;
  } catch (e) {
    log(`[notify] ошибка сети: ${(e as Error).message}`);
    return false;
  }
}

/** Хелпер: собрать HTML-блок алерта с заголовком и строками. */
export function alertBlock(title: string, lines: string[]): string {
  return `<b>${esc(title)}</b>\n` + lines.map((l) => esc(l)).join('\n');
}

export interface TgMessage {
  updateId: number;
  chatId: number | string;
  text: string;
  from: string;
}

/** Опрос входящих сообщений (короткий poll). offset = update_id+1 последнего обработанного. */
export async function getUpdates(offset: number): Promise<TgMessage[]> {
  if (!TELEGRAM_TOKEN) return [];
  try {
    const r = await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/getUpdates?offset=${offset}&timeout=0`);
    const j = (await r.json()) as { ok?: boolean; result?: any[] };
    if (!j.ok) return [];
    return (j.result || []).map((u) => {
      const m = u.message || u.channel_post || u.edited_message || {};
      return {
        updateId: u.update_id,
        chatId: m.chat?.id ?? 0,
        text: typeof m.text === 'string' ? m.text : '',
        from: m.from?.username || m.from?.first_name || String(m.from?.id || ''),
      };
    });
  } catch (e) {
    log(`[getUpdates] ошибка: ${(e as Error).message}`);
    return [];
  }
}

/** Ответ в конкретный чат (HTML). */
export async function reply(chatId: number | string, text: string): Promise<boolean> {
  if (!TELEGRAM_TOKEN) return false;
  try {
    const r = await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML', disable_web_page_preview: true }),
    });
    const j = (await r.json()) as { ok?: boolean };
    return !!j.ok;
  } catch {
    return false;
  }
}
