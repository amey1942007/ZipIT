import { clampLimits, LOAD_TIMEOUT_MS, type RunLimits } from '@/arena/limits'
import { replayLog, type RunOutcome, type RunStatus } from '@/arena/referee'
import {
  type ReplayPuzzle,
  type ReplayStep,
  withinColumnLimits,
} from '@/arena/replayContract'
import { replayScore } from '@/arena/scoreLocal'
import { pyodideIndexUrl } from '@/workers/pyodideConfig'
import HeuristicWorker from '@/workers/heuristic.worker.ts?worker&inline'

export interface HeuristicRunRequest {
  code: string
  puzzle: ReplayPuzzle
  seed?: number
  limits?: Partial<RunLimits>
  onSteps?: (count: number) => void
  signal?: AbortSignal
}

interface WorkerMessage {
  type?: string
  steps?: ReplayStep[]
  status?: RunStatus
  error?: string | null
}

function asMessage(data: unknown): WorkerMessage | null {
  let value = data
  if (typeof data === 'string') {
    try {
      value = JSON.parse(data) as unknown
    } catch {
      return null
    }
  }
  if (!value || typeof value !== 'object') return null
  return value as WorkerMessage
}

function isStep(value: unknown): value is ReplayStep {
  if (!Array.isArray(value) || value.length !== 4) return false
  const [op, r, c, t] = value
  return (
    (op === 'm' || op === 'b' || op === 'x') &&
    Number.isInteger(r) &&
    Number.isInteger(c) &&
    Number.isInteger(t)
  )
}

function outcomeFromLog(
  puzzle: ReplayPuzzle,
  steps: ReplayStep[],
  status: RunStatus,
  error: string | null,
): RunOutcome {
  const checked = replayLog(puzzle, steps)
  const solved = checked.ok && checked.status === 'solved' && status !== 'timeout' && status !== 'error'
  const summary = checked.ok
    ? { ...checked.summary, solved }
    : { moves: 0, backtracks: 0, time_ms: 0, solved: false }
  const cutoff = status === 'step_cap' || (checked.ok && checked.cutoff)
  return {
    puzzle,
    steps: checked.ok ? steps : [],
    summary,
    cutoff,
    invalid: checked.ok ? checked.invalid : 0,
    status: checked.ok ? (status === 'timeout' || status === 'error' ? status : checked.status) : 'error',
    maxDepth: checked.ok ? checked.maxDepth : 0,
    scoreLocal: replayScore(checked.ok ? checked.maxDepth : 0, puzzle.rows, puzzle.cols),
    error: checked.ok ? error : checked.error,
    savable: checked.ok && error == null && withinColumnLimits({ puzzle, steps, summary }),
  }
}

/**
 * Run team Python in a fresh inline worker. The main thread re-simulates the
 * log before the result is marked savable. The worker is terminated on timeout.
 */
export function runHeuristic(request: HeuristicRunRequest): Promise<RunOutcome> {
  const limits = clampLimits(request.limits)
  const worker = new HeuristicWorker()
  const steps: ReplayStep[] = []
  let phase: 'load' | 'run' = 'load'
  let timer = 0
  let settled = false

  return new Promise((resolve) => {
    const finish = (status: RunStatus, error: string | null) => {
      if (settled) return
      settled = true
      window.clearTimeout(timer)
      worker.terminate()
      resolve(outcomeFromLog(request.puzzle, steps, status, error))
    }

    const cancel = () => finish('error', 'cancelled')
    if (request.signal?.aborted) {
      cancel()
      return
    }
    request.signal?.addEventListener('abort', cancel, { once: true })

    timer = window.setTimeout(() => finish('timeout', null), LOAD_TIMEOUT_MS)

    worker.onmessage = (event: MessageEvent<unknown>) => {
      const message = asMessage(event.data)
      if (!message?.type) return
      if (message.type === 'ready') {
        phase = 'run'
        window.clearTimeout(timer)
        timer = window.setTimeout(() => finish('timeout', null), limits.timeout_ms)
        const indexFree = {
          type: 'run',
          code: request.code,
          puzzle: request.puzzle,
          limits,
          seed: request.seed ?? request.puzzle.seed,
        }
        worker.postMessage(JSON.parse(JSON.stringify(indexFree)))
        return
      }
      if (message.type === 'chunk' && Array.isArray(message.steps)) {
        for (const step of message.steps) if (isStep(step)) steps.push(step)
        request.onSteps?.(steps.length)
        return
      }
      if (message.type === 'done' || message.type === 'error') {
        finish(message.status ?? 'error', message.error ?? (message.type === 'error' ? 'worker' : null))
      }
    }
    worker.onerror = () => finish('error', 'worker')

    const indexURL = pyodideIndexUrl(window.location.origin, import.meta.env.BASE_URL)
    worker.postMessage(JSON.parse(JSON.stringify({ type: 'init', indexURL })))
    void phase
  })
}
