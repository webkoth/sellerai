import { desc } from "drizzle-orm"
import { createDb, drizzleRunStore, runs, seedChannels } from "@sync2/db"
import { loadConfig } from "@sync2/shared"
import { createLogger } from "./log"
import { withRun } from "./run"

const USAGE = `sync2 <команда>
  seed-channels   завести пять площадок (режим записи не трогается)
  runs [N]        последние N запусков (по умолчанию 20)
  ping            пустая джоба: проверка конфига, базы и журнала`

async function main(argv: string[]): Promise<number> {
  const [cmd, arg] = argv
  if (!cmd || cmd === "help") {
    console.log(USAGE)
    return cmd ? 0 : 2
  }
  const config = loadConfig(process.env)
  const log = createLogger(config.logLevel)
  const { db, close } = createDb(config.databaseUrl)
  try {
    switch (cmd) {
      case "seed-channels":
        await seedChannels(db)
        log.info("площадки заведены")
        return 0
      case "runs": {
        // Number(undefined) = NaN, а не 20 — подставляем значение по умолчанию до Number().
        const limit = Number(arg ?? 20)
        if (!Number.isInteger(limit) || limit <= 0) {
          console.error(`некорректное число: ${arg}\n\n${USAGE}`)
          return 2
        }
        const rows = await db.select().from(runs).orderBy(desc(runs.startedAt)).limit(limit)
        for (const r of rows) {
          console.log([r.startedAt, r.job, r.status, r.writeMode, JSON.stringify(r.counters), r.error ?? ""].join("\t"))
        }
        return 0
      }
      case "ping": {
        const out = await withRun("ping", { store: drizzleRunStore(db), log, writeMode: config.writeMode }, async (ctx) => {
          ctx.log.info("pong")
          return { counters: {} }
        })
        return out.status === "failed" ? 1 : 0
      }
      default:
        console.error(`неизвестная команда: ${cmd}\n\n${USAGE}`)
        return 2
    }
  } finally {
    await close()
  }
}

process.exitCode = await main(process.argv.slice(2))
