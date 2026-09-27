import { isChannel, parseWriteMode, type Channel, type WriteMode } from "@sync2/shared"
import type { Db } from "./client"
import { channels } from "./schema"

export interface ChannelRow {
  id: number
  writeMode: WriteMode
}

/** Площадки из базы: код → id и режим записи. Неизвестный код или режим — ошибка, а не тихий пропуск. */
export async function loadChannels(db: Db): Promise<Map<Channel, ChannelRow>> {
  const out = new Map<Channel, ChannelRow>()
  for (const r of await db.select().from(channels)) {
    if (!isChannel(r.code)) throw new Error(`неизвестная площадка в таблице channels: ${r.code}`)
    out.set(r.code, { id: r.id, writeMode: parseWriteMode(r.writeMode, "off") })
  }
  return out
}
