import { randomUUID } from "node:crypto"
import { errorText, type RunStatus, type RunStore, type WriteMode } from "@sync2/shared"
import type { Logger } from "./log"

export interface RunContext {
  runId: string
  log: Logger
}

export interface JobResult {
  /** Не указано — ok. partial — джоба что-то пропустила; путать с ok нельзя. */
  status?: "ok" | "partial"
  counters: Record<string, number>
  /** Тексты ошибок отдельных площадок (join("; ")) — пишутся в runs.error при partial. */
  error?: string
}

export interface RunDeps {
  store: RunStore
  log: Logger
  writeMode: WriteMode
  now?: () => Date
  newId?: () => string
}

export interface RunOutcome {
  runId: string
  status: Exclude<RunStatus, "running">
  counters: Record<string, number>
  error: string | null
}

/**
 * Оборачивает джобу записью в журнал `runs`. Сбой джобы не роняет процесс: он
 * записывается как failed. Запуск и закрывающая запись — в раздельных try/catch:
 * сбой записи журнала после успешной джобы не должен переписать успех в провал
 * (урок finstock, apps/worker/src/lib/run-log.ts).
 */
export async function withRun(
  job: string,
  deps: RunDeps,
  fn: (ctx: RunContext) => Promise<JobResult>,
): Promise<RunOutcome> {
  const now = deps.now ?? (() => new Date())
  const runId = (deps.newId ?? randomUUID)()
  const log = deps.log.child({ run_id: runId, job })

  try {
    await deps.store.start({ runId, job, writeMode: deps.writeMode, startedAt: now().toISOString() })
  } catch (e: unknown) {
    // Открывающая запись не удалась — запуска нет, притворяться им нельзя: наружу летит исключение.
    log.error({ err: e }, "не удалось открыть запись журнала")
    throw e
  }
  log.info({ writeMode: deps.writeMode }, "старт")

  let outcome: RunOutcome
  try {
    const result = await fn({ runId, log })
    outcome = { runId, status: result.status ?? "ok", counters: result.counters, error: result.error ?? null }
  } catch (e: unknown) {
    const error = errorText(e)
    // Ошибка записи площадок (WriteJournalError из @sync2/platforms) несёт итоги по
    // позициям: площадки уже могли принять изменения, эти строки нельзя потерять
    // в одном текстовом сообщении. Duck-typing вместо импорта platforms в worker.
    // e может быть null/не-объектом (throw null/throw "текст") — проверяем перед доступом к полю.
    const outcomes = e !== null && typeof e === "object" ? (e as { outcomes?: unknown }).outcomes : undefined
    if (outcomes !== undefined) {
      log.error({ err: e, outcomes }, "джоба упала")
    } else {
      log.error({ err: e }, "джоба упала")
    }
    outcome = { runId, status: "failed", counters: {}, error }
  }

  try {
    await deps.store.finish(runId, {
      status: outcome.status,
      finishedAt: now().toISOString(),
      counters: outcome.counters,
      error: outcome.error,
    })
  } catch (e: unknown) {
    log.error({ err: e }, "не удалось закрыть запись журнала")
  }
  log.info({ status: outcome.status, counters: outcome.counters }, "финиш")
  return outcome
}
