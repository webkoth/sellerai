import { desc, eq } from "drizzle-orm"
import { channels, createDb, drizzleRunStore, lastRunStatus, nonOkStreak, runs, seedChannels, type Db } from "@sync2/db"
import {
  createKitAdapter,
  createOzonAdapter,
  createWbAdapter,
  createYmAdapter,
  type ChannelAdapter,
} from "@sync2/platforms"
import {
  buildWbCatalogIndex,
  errorText,
  isChannel,
  loadConfig,
  ORDER_LIFECYCLES,
  WRITE_MODES,
  type ChannelOrder,
  type Config,
  type WbCatalogIndex,
} from "@sync2/shared"
import { buildAdapters } from "./adapters"
import { loadChannelsConfig } from "./channels-config"
import { runCompareV1 } from "./jobs/compare-v1"
import { runIngest } from "./jobs/ingest"
import { runPool } from "./jobs/pool"
import { createLogger, type Logger } from "./log"
import { createNotifier, type Notifier } from "./notify"
import { withRun, type RunOutcome } from "./run"
import { decideNotification, describeOutcome } from "./transition"

const USAGE = `sync2 <команда>
  seed-channels          завести пять площадок (режим записи не трогается)
  runs [N]               последние N запусков (по умолчанию 20)
  ping                   пустая джоба: проверка конфига, базы и журнала
  probe                  живое чтение четырёх площадок (WB, Ozon, ЯМ, KIT) без базы и записи
  ingest [--accept-catalog]
                         каталог WB, заказы и снимки остатков всех площадок в базу;
                         --accept-catalog — принять каталог WB без проверки усадки (усадка настоящая)
  pool                   пересчёт пула и план записей (dry-run в этапе 1.3b)
  tick [--accept-catalog]
                         ingest, затем pool (pool — если ingest не failed)
  compare-v1             сверка пула с леджером старого синка, сводка в Telegram
  write-mode <площадка> <off|dry-run|apply>   режим записи одной площадки (apply отклонён в 1.3b)`

/** Ручной обход ворот каталога WB в ingest (и tick): принять каталог без проверки доли. */
const ACCEPT_CATALOG_FLAG = "--accept-catalog"
const PROBE_WINDOW_MS = 60 * 24 * 60 * 60 * 1000
/** Путь по умолчанию к леджеру старого синка на VPS (план 1.3b, задача 6). */
const DEFAULT_V1_LEDGER_PATH = "/opt/sellerai-sync/data/state/inventory.json"

/** Первые 20 штрихкодов/артикулов без штрихкода WB — остальное только счётом (план, задача 7). */
function formatSkipped(channel: string, skipped: string[]): string | null {
  if (skipped.length === 0) return null
  const shown = skipped.slice(0, 20)
  const rest = skipped.length > shown.length ? `, … (ещё ${skipped.length - shown.length})` : ""
  return `${channel} | пропусков без штрихкода WB: ${skipped.length} — ${shown.join(", ")}${rest}`
}

/** Заказы по жизненному циклу одной строкой: `open=.., shipped=.., …`. */
function lifecycleBreakdown(orders: ChannelOrder[]): string {
  const byLifecycle = Object.fromEntries(ORDER_LIFECYCLES.map((l) => [l, 0])) as Record<(typeof ORDER_LIFECYCLES)[number], number>
  for (const order of orders) byLifecycle[order.lifecycle]++
  return ORDER_LIFECYCLES.map((l) => `${l}=${byLifecycle[l]}`).join(", ")
}

/**
 * Одна строка сводки на площадку: заказы по жизненному циклу, снимок остатков.
 * Формат — план, задача 7, Step 3.
 */
function printChannelSummary(channel: string, orders: ChannelOrder[], stocks: { stocks: { quantity: number }[]; skippedNoWbBarcode: string[] }): void {
  const totalQty = stocks.stocks.reduce((sum, s) => sum + s.quantity, 0)
  const inStock = stocks.stocks.filter((s) => s.quantity > 0).length
  console.log(
    `${channel} | заказов: ${orders.length} (${lifecycleBreakdown(orders)}) | строк остатков: ${stocks.stocks.length} | штук: ${totalQty} | в наличии: ${inStock} | пропусков без штрихкода WB: ${stocks.skippedNoWbBarcode.length}`,
  )
}

/**
 * WB-каталог не прочитался — у Ozon/ЯМ/KIT нет индекса штрихкодов WB, и
 * `resolveWbBarcode` не сопоставит почти ничего: печатать остатки в этом
 * состоянии как настоящие значит выдать почти пустой (или бессмысленный)
 * снимок за реальный. Остатки поэтому не запрашиваются вовсе, заказы —
 * запрашиваются и печатаются как обычно (они не зависят от каталога WB).
 */
function printChannelSummaryWithoutWbCatalog(channel: string, orders: ChannelOrder[]): void {
  console.log(
    `${channel} | заказов: ${orders.length} (${lifecycleBreakdown(orders)}) (без каталога WB — остатки не сопоставлены) | остатки: пропущены`,
  )
}

/**
 * `probe` — живое чтение четырёх площадок без базы и без единой записи.
 * Последовательно, не параллельно: общие лимиты с работающим старым синком
 * (план, задача 7, Step 3). Сбой одной площадки не останавливает остальные —
 * каждая обёрнута в свой try/catch, итоговый код выхода 1, если сбоила хоть одна.
 */
async function runProbe(env: NodeJS.ProcessEnv): Promise<number> {
  // Битый или неполный конфиг — не запуск с частичными площадками и не
  // необработанный отказ промиса со стек-трейсом: понятная строка в stderr
  // и код выхода 2 (как у неизвестной команды), отдельно от кода 1 сбоя
  // конкретной площадки при живом чтении ниже.
  let config: ReturnType<typeof loadChannelsConfig>
  try {
    config = loadChannelsConfig(env)
  } catch (e) {
    console.error(`ОШИБКА конфига: ${errorText(e)}`)
    return 2
  }
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
  channels.push({ channel: "kit", adapter: createKitAdapter(config.kit, wbIndex) })

  const skippedByChannel = new Map<string, string[]>()
  for (const { channel, adapter } of channels) {
    try {
      const orders = await adapter.fetchOrders(since)
      if (wbCatalogOk) {
        const stocks = await adapter.fetchStocks()
        printChannelSummary(channel, orders, stocks)
        skippedByChannel.set(channel, stocks.skippedNoWbBarcode)
      } else {
        // wb сюда не попадает (см. выше) — это всегда Ozon/ЯМ/KIT: без
        // каталога WB их остатки не сопоставятся, поэтому не запрашиваются
        // и не печатаются как настоящие.
        printChannelSummaryWithoutWbCatalog(channel, orders)
      }
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

/**
 * Уведомление о прогоне джобы — решение в decideNotification (transition.ts),
 * здесь только данные из журнала и отправка. Не доставлено — warn в лог:
 * переход не должен теряться молча.
 */
async function notifyTransition(db: Db, log: Logger, notifier: Notifier, job: string, prev: RunOutcome["status"] | null, outcome: RunOutcome): Promise<void> {
  const streak = outcome.status === "ok" ? 0 : await nonOkStreak(db, job)
  const text = decideNotification({ job, prev, cur: { status: outcome.status, detail: describeOutcome(outcome) }, nonOkStreak: streak })
  if (text === null) return
  if (!(await notifier.send(text))) log.warn({ job, text }, "уведомление в Telegram не доставлено")
}

/** Джоба `ingest` внутри `withRun`, с уведомлением о смене состояния. */
async function runIngestCommand(db: Db, log: Logger, config: Config, notifier: Notifier, acceptCatalog: boolean): Promise<RunOutcome> {
  const prevStatus = await lastRunStatus(db, "ingest")
  const outcome = await withRun("ingest", { store: drizzleRunStore(db), log, writeMode: config.writeMode }, async (ctx) => {
    const adapters = buildAdapters(loadChannelsConfig(process.env))
    const result = await runIngest({ db, now: () => new Date(), runId: ctx.runId, adapters, acceptCatalog, log: ctx.log })
    return { status: result.status, counters: result.counters, error: result.errors.length ? result.errors.join("; ") : undefined }
  })
  await notifyTransition(db, log, notifier, "ingest", prevStatus, outcome)
  return outcome
}

/** Джоба `pool` внутри `withRun`, с уведомлением о смене состояния. */
async function runPoolCommand(db: Db, log: Logger, config: Config, notifier: Notifier): Promise<RunOutcome> {
  const prevStatus = await lastRunStatus(db, "pool")
  const outcome = await withRun("pool", { store: drizzleRunStore(db), log, writeMode: config.writeMode }, async (ctx) => {
    const result = await runPool({ db, now: () => new Date(), runId: ctx.runId, globalMode: config.writeMode })
    return { status: result.status, counters: result.counters, error: result.error }
  })
  await notifyTransition(db, log, notifier, "pool", prevStatus, outcome)
  return outcome
}

async function main(argv: string[]): Promise<number> {
  const [cmd, arg, arg2] = argv.filter((a) => !a.startsWith("--"))
  const flags = argv.filter((a) => a.startsWith("--"))
  if (!cmd || cmd === "help") {
    console.log(USAGE)
    return cmd ? 0 : 2
  }
  // Единственный флаг — ручной обход ворот каталога WB, и только там, где есть ingest.
  for (const flag of flags) {
    if (flag !== ACCEPT_CATALOG_FLAG || (cmd !== "ingest" && cmd !== "tick")) {
      console.error(`неизвестный флаг для ${cmd}: ${flag}\n\n${USAGE}`)
      return 2
    }
  }
  const acceptCatalog = flags.includes(ACCEPT_CATALOG_FLAG)
  // probe — только чтение площадок, без базы: не должен требовать DATABASE_URL
  // и не должен трогать журнал runs (план, задача 7, Step 3).
  if (cmd === "probe") {
    return runProbe(process.env)
  }
  const config = loadConfig(process.env)
  const log = createLogger(config.logLevel)
  const { db, close } = createDb(config.databaseUrl)
  const notifier = createNotifier({ token: process.env.TELEGRAM_BOT_TOKEN ?? "", chatId: process.env.TELEGRAM_CHAT_ID ?? "" })
  try {
    switch (cmd) {
      case "seed-channels":
        await seedChannels(db)
        log.info("площадки заведены")
        return 0
      case "ingest": {
        const outcome = await runIngestCommand(db, log, config, notifier, acceptCatalog)
        return outcome.status === "failed" ? 1 : 0
      }
      case "pool": {
        const outcome = await runPoolCommand(db, log, config, notifier)
        return outcome.status === "failed" ? 1 : 0
      }
      case "tick": {
        // pool пересчитывается и после partial у ingest (частичные данные лучше, чем никакие),
        // но не после failed: без записи в базу пул считать не от чего.
        const ingestOutcome = await runIngestCommand(db, log, config, notifier, acceptCatalog)
        if (ingestOutcome.status === "failed") return 1
        const poolOutcome = await runPoolCommand(db, log, config, notifier)
        return poolOutcome.status === "failed" ? 1 : 0
      }
      case "compare-v1": {
        const outcome = await withRun("compare-v1", { store: drizzleRunStore(db), log, writeMode: config.writeMode }, async () => {
          const ledgerPath = process.env.V1_LEDGER_PATH?.trim() || DEFAULT_V1_LEDGER_PATH
          const result = await runCompareV1({ db, ledgerPath, notifier, now: () => new Date() })
          return { counters: { same: result.same, diff: result.diff, onlyV1: result.onlyV1, onlyV2: result.onlyV2 } }
        })
        return outcome.status === "failed" ? 1 : 0
      }
      case "write-mode": {
        if (!arg || !isChannel(arg)) {
          console.error(`неизвестная площадка: ${arg}\n\n${USAGE}`)
          return 2
        }
        if (arg2 === "apply") {
          console.error("apply отклонён: запись на площадки подключается на этапе 1.4")
          return 2
        }
        if (arg2 !== "off" && arg2 !== "dry-run") {
          console.error(`неизвестный режим записи: ${arg2} (ожидается ${WRITE_MODES.join(" | ")})\n\n${USAGE}`)
          return 2
        }
        const updated = await db.update(channels).set({ writeMode: arg2 }).where(eq(channels.code, arg)).returning({ code: channels.code })
        if (updated.length === 0) {
          console.error(`площадка ${arg} не заведена в базе — выполните seed-channels`)
          return 2
        }
        const rows = await db.select({ code: channels.code, writeMode: channels.writeMode }).from(channels).orderBy(channels.code)
        for (const r of rows) console.log(`${r.code}\t${r.writeMode}`)
        return 0
      }
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
