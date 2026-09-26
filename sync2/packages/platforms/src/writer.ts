import { WRITE_MODES, type Channel, type WriteMode } from "@sync2/shared"

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

const rank = (m: WriteMode) => WRITE_MODES.indexOf(m)

/** Действует меньший из двух ключей: глобального SYNC_WRITE_MODE и режима площадки в таблице channels. */
export function effectiveMode(global: WriteMode, channel: WriteMode): WriteMode {
  return rank(global) <= rank(channel) ? global : channel
}

/**
 * Единственный путь записи на площадки. В off и dry-run сеть не трогается вовсе —
 * это проверено тестом и не должно обходиться ни одним адаптером.
 */
export async function executeWrites(ops: WriteOp[], deps: WriteDeps): Promise<WriteOutcome[]> {
  const byChannel = new Map<Channel, WriteOp[]>()
  for (const o of ops) byChannel.set(o.channel, [...(byChannel.get(o.channel) ?? []), o])

  const outcomes: WriteOutcome[] = []
  for (const [channel, channelOps] of byChannel) {
    const mode = effectiveMode(deps.globalMode, deps.channelModes[channel])
    if (mode !== "apply") {
      for (const o of channelOps) outcomes.push({ ...o, mode, applied: false, response: null, error: null })
      continue
    }
    let results: SendResult[]
    try {
      results = await deps.send(channel, channelOps)
    } catch (e: unknown) {
      const error = e instanceof Error ? e.message : String(e)
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
  await deps.record(outcomes)
  return outcomes
}
