import type { WriteMode } from "./channels"

export type RunStatus = "running" | "ok" | "partial" | "failed"

export interface RunStart {
  runId: string
  job: string
  writeMode: WriteMode
  startedAt: string
}

export interface RunFinish {
  status: Exclude<RunStatus, "running">
  finishedAt: string
  counters: Record<string, number>
  error: string | null
}

export interface RunStore {
  start(run: RunStart): Promise<void>
  finish(runId: string, result: RunFinish): Promise<void>
}
