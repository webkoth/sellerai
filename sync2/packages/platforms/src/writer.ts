import { WRITE_MODES, errorText, isChannel, type Channel, type WriteMode } from "@sync2/shared"

/** Одна запись на площадку: поле товара было → станет. */
export interface WriteOp {
  channel: Channel
  barcode: string
  field: "stock" | "price"
  before: number | null
  after: number
}

/** Ответ площадки по одной позиции. Адаптер обязан вернуть по строке на каждую отправленную. */
export interface SendResult {
  barcode: string
  field: WriteOp["field"]
  ok: boolean
  response?: unknown
  error?: string
}

/** Сетевой вызов площадки. Передаётся адаптером; сам выключатель в сеть не ходит. */
export type Sender = (channel: Channel, ops: WriteOp[]) => Promise<SendResult[]>

export interface WriteOutcome extends WriteOp {
  mode: WriteMode
  applied: boolean
  response: unknown
  error: string | null
}

export interface WriteDeps {
  globalMode: WriteMode
  channelModes: Record<Channel, WriteMode>
  send: Sender
  /** Запись итогов в журнал `writes`. Вызывается один раз, со всеми позициями, в любом режиме. */
  record: (outcomes: WriteOutcome[]) => Promise<void>
}

/**
 * Журнал не записался после того, как площадки уже могли принять изменения —
 * молча проглотить это нельзя, но и итоги терять нельзя: они едут вместе с ошибкой.
 */
export class WriteJournalError extends Error {
  public readonly outcomes: WriteOutcome[]

  constructor(message: string, options: { cause: unknown; outcomes: WriteOutcome[] }) {
    super(message, { cause: options.cause })
    this.name = "WriteJournalError"
    this.outcomes = options.outcomes
  }
}

const rank = (m: WriteMode) => WRITE_MODES.indexOf(m)

const isWriteMode = (value: unknown): value is WriteMode =>
  typeof value === "string" && (WRITE_MODES as readonly string[]).includes(value)

/** Действует меньший из двух ключей: глобального SYNC_WRITE_MODE и режима площадки в таблице channels. */
export function effectiveMode(global: WriteMode, channel: WriteMode): WriteMode {
  return rank(global) <= rank(channel) ? global : channel
}

/**
 * Единственный путь записи на площадки. В off и dry-run сеть не трогается вовсе —
 * это проверено тестом и не должно обходиться ни одним адаптером.
 */
export async function executeWrites(ops: WriteOp[], deps: WriteDeps): Promise<WriteOutcome[]> {
  // Дубль по ключу channel+barcode+field перезапишет сам себя в журнале — ловим до сети, а не после.
  const seen = new Set<string>()
  for (const o of ops) {
    const dupKey = `${o.channel}\u0000${o.barcode}\u0000${o.field}`
    if (seen.has(dupKey)) throw new Error(`дубль операции записи: ${o.channel}/${o.barcode}/${o.field}`)
    seen.add(dupKey)
  }

  const byChannel = new Map<Channel, WriteOp[]>()
  for (const o of ops) byChannel.set(o.channel, [...(byChannel.get(o.channel) ?? []), o])

  // Битый глобальный режим — не повод угадывать: считаем его выключенным, как и опечатку площадки.
  const globalMode = isWriteMode(deps.globalMode) ? deps.globalMode : "off"

  const outcomes: WriteOutcome[] = []
  for (const [channel, channelOps] of byChannel) {
    const channelMode = deps.channelModes[channel]
    const safeChannelMode = isWriteMode(channelMode) ? channelMode : "off"
    // Площадка, которой нет в списке известных, не должна попасть в сеть ни при каких режимах.
    const mode: WriteMode = isChannel(channel) ? effectiveMode(globalMode, safeChannelMode) : "off"
    if (mode !== "apply") {
      for (const o of channelOps) outcomes.push({ ...o, mode, applied: false, response: null, error: null })
      continue
    }
    let results: SendResult[]
    try {
      const raw = await deps.send(channel, channelOps)
      if (!Array.isArray(raw)) throw new Error("площадка вернула ответ не списком")
      results = raw
    } catch (e: unknown) {
      const error = errorText(e)
      for (const o of channelOps) outcomes.push({ ...o, mode, applied: false, response: null, error })
      continue
    }
    const key = (barcode: string, field: string) => `${barcode}\u0000${field}`
    const byKey = new Map(results.map((r) => [key(r.barcode, r.field), r]))
    for (const o of channelOps) {
      const r = byKey.get(key(o.barcode, o.field))
      if (!r) {
        outcomes.push({ ...o, mode, applied: false, response: null, error: "площадка не вернула результат по позиции" })
      } else {
        outcomes.push({ ...o, mode, applied: r.ok, response: r.response ?? null, error: r.ok ? null : (r.error ?? "отказ без текста") })
      }
    }
  }

  try {
    await deps.record(outcomes)
  } catch (e: unknown) {
    // На площадке уже могло уйти изменение — журнал без этих строк не восстановить, поэтому отдаём их вызывающему.
    throw new WriteJournalError(`журнал записей не сохранён: ${errorText(e)}`, { cause: e, outcomes })
  }
  return outcomes
}
