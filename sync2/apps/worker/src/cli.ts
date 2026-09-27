import { desc } from "drizzle-orm"
import { createDb, drizzleRunStore, runs, seedChannels } from "@sync2/db"
import {
  createKitAdapter,
  createOzonAdapter,
  createWbAdapter,
  createYmAdapter,
  type ChannelAdapter,
} from "@sync2/platforms"
import { buildWbCatalogIndex, errorText, loadConfig, ORDER_LIFECYCLES, type ChannelOrder, type WbCatalogIndex } from "@sync2/shared"
import { loadChannelsConfig } from "./channels-config"
import { createLogger } from "./log"
import { withRun } from "./run"

const USAGE = `sync2 <команда>
  seed-channels   завести пять площадок (режим записи не трогается)
  runs [N]        последние N запусков (по умолчанию 20)
  ping            пустая джоба: проверка конфига, базы и журнала
  probe           живое чтение четырёх площадок (WB, Ozon, ЯМ, KIT) без базы и записи`

const PROBE_WINDOW_MS = 60 * 24 * 60 * 60 * 1000

/** Первые 20 штрихкодов/артикулов без штрихкода WB — остальное только счётом (план, задача 7). */
function formatSkipped(channel: string, skipped: string[]): string | null {
  if (skipped.length === 0) return null
  const shown = skipped.slice(0, 20)
  const rest = skipped.length > shown.length ? `, … (ещё ${skipped.length - shown.length})` : ""
  return `${channel} | пропусков без штрихкода WB: ${skipped.length} — ${shown.join(", ")}${rest}`
}

/**
 * Одна строка сводки на площадку: заказы по жизненному циклу, снимок остатков.
 * Формат — план, задача 7, Step 3.
 */
function printChannelSummary(channel: string, orders: ChannelOrder[], stocks: { stocks: { quantity: number }[]; skippedNoWbBarcode: string[] }): void {
  const byLifecycle = Object.fromEntries(ORDER_LIFECYCLES.map((l) => [l, 0])) as Record<(typeof ORDER_LIFECYCLES)[number], number>
  for (const order of orders) byLifecycle[order.lifecycle]++
  const lifecycleText = ORDER_LIFECYCLES.map((l) => `${l}=${byLifecycle[l]}`).join(", ")
  const totalQty = stocks.stocks.reduce((sum, s) => sum + s.quantity, 0)
  const inStock = stocks.stocks.filter((s) => s.quantity > 0).length
  console.log(
    `${channel} | заказов: ${orders.length} (${lifecycleText}) | строк остатков: ${stocks.stocks.length} | штук: ${totalQty} | в наличии: ${inStock} | пропусков без штрихкода WB: ${stocks.skippedNoWbBarcode.length}`,
  )
}

/**
 * `probe` — живое чтение четырёх площадок без базы и без единой записи.
 * Последовательно, не параллельно: общие лимиты с работающим старым синком
 * (план, задача 7, Step 3). Сбой одной площадки не останавливает остальные —
 * каждая обёрнута в свой try/catch, итоговый код выхода 1, если сбоила хоть одна.
 */
async function runProbe(env: NodeJS.ProcessEnv): Promise<number> {
  const config = loadChannelsConfig(env)
  const since = new Date(Date.now() - PROBE_WINDOW_MS).toISOString()
  let exitCode = 0

  // WB — источник каталога и индекса штрихкодов WB, нужного Ozon и ЯМ для
  // resolveWbBarcode. Читается первым; если каталог не читается, Ozon и ЯМ
  // всё равно запускаются (с пустым индексом — сироты уйдут в пропуски),
  // WB получает отдельную строку ОШИБКА и в общий цикл ниже не попадает
  // (иначе тот же сбой напечатался бы дважды).
  const wbAdapter = createWbAdapter(config.wb.token)
  let wbIndex: WbCatalogIndex = buildWbCatalogIndex([])
  let wbCatalogOk = true
  try {
    wbIndex = buildWbCatalogIndex(await wbAdapter.fetchCatalog())
  } catch (e) {
    console.log(`wb | ОШИБКА ${errorText(e)}`)
    exitCode = 1
    wbCatalogOk = false
  }

  const channels: Array<{ channel: string; adapter: ChannelAdapter }> = []
  if (wbCatalogOk) channels.push({ channel: "wb", adapter: wbAdapter })
  channels.push({ channel: "ozon", adapter: createOzonAdapter(config.ozon, wbIndex) })
  channels.push({ channel: "ym", adapter: createYmAdapter(config.ym, wbIndex, config.ym.warehouseIds) })
  channels.push({ channel: "kit", adapter: createKitAdapter(config.kit) })

  const skippedByChannel = new Map<string, string[]>()
  for (const { channel, adapter } of channels) {
    try {
      const orders = await adapter.fetchOrders(since)
      const stocks = await adapter.fetchStocks()
      printChannelSummary(channel, orders, stocks)
      skippedByChannel.set(channel, stocks.skippedNoWbBarcode)
    } catch (e) {
      console.log(`${channel} | ОШИБКА ${errorText(e)}`)
      exitCode = 1
    }
  }

  for (const [channel, skipped] of skippedByChannel) {
    const line = formatSkipped(channel, skipped)
    if (line) console.log(line)
  }

  return exitCode
}

async function main(argv: string[]): Promise<number> {
  const [cmd, arg] = argv
  if (!cmd || cmd === "help") {
    console.log(USAGE)
    return cmd ? 0 : 2
  }
  // probe — только чтение площадок, без базы: не должен требовать DATABASE_URL
  // и не должен трогать журнал runs (план, задача 7, Step 3).
  if (cmd === "probe") {
    return runProbe(process.env)
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
