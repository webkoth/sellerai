import { sql } from "drizzle-orm"
import { CHANNELS, CHANNEL_TITLES } from "@sync2/shared"
import type { Db } from "./client"
import { channels } from "./schema"

/** Заводит недостающие площадки. Название обновляет, режим записи и склад — никогда. */
export async function seedChannels(db: Db): Promise<void> {
  await db
    .insert(channels)
    .values(CHANNELS.map((code) => ({ code, title: CHANNEL_TITLES[code] })))
    .onConflictDoUpdate({ target: channels.code, set: { title: sql`excluded.title` } })
}
