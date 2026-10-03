import {
  asChecks,
  asResult,
  GRADING_LIMITS,
  puzzleToBoard,
  type CheckResult,
  type EngineLimits,
  type EngineResult,
  type SubmissionCode,
} from '@/arena/engineCore'
import { LOAD_TIMEOUT_MS } from '@/arena/limits'
import type { ZipPuzzle } from '@/lib/zip/types'
import { pyodideIndexUrl } from '@/workers/pyodideConfig'
import EngineWorker from '@/workers/engine.worker.ts?worker&inline'

export * from '@/arena/engineCore'

const CHECK_TIMEOUT_MS = 20_000

type Reply = { type: string; checks?: unknown; result?: unknown; trace?: unknown; error?: string }

interface Pending {
  resolve: (data: Reply) => void
  timer: number
}

/**
 * One Pyodide worker reused across runs. A run that blows the hard timeout terminates
 * the worker; the next call boots a fresh one.
 */
export class EngineClient {
  private worker: Worker | null = null
  private ready: Promise<boolean> | null = null
  private seq = 0
  private pending = new Map<number, Pending>()

  private boot(): Promise<boolean> {
    if (this.ready) return this.ready
    const worker = new EngineWorker()
    this.worker = worker
    this.ready = new Promise<boolean>((resolve) => {
      const timer = window.setTimeout(() => {
        this.reset()
        resolve(false)
      }, LOAD_TIMEOUT_MS)
      worker.onmessage = (event: MessageEvent<unknown>) => {
        const data = (event.data ?? {}) as { type?: string; id?: number; error?: string }
        if (data.type === 'ready') {
          window.clearTimeout(timer)
          resolve(true)
          return
        }
        if (data.type === 'error' && data.id === undefined) {
          window.clearTimeout(timer)
          this.reset()
          resolve(false)
          return
        }
        if (typeof data.id === 'number') {
          const entry = this.pending.get(data.id)
          if (!entry) return
          window.clearTimeout(entry.timer)
          this.pending.delete(data.id)
          entry.resolve(data as Reply)
        }
      }
      worker.onerror = () => {
        window.clearTimeout(timer)
        this.reset()
        resolve(false)
      }
      const indexURL = pyodideIndexUrl(window.location.origin, import.meta.env.BASE_URL)
      worker.postMessage({ type: 'init', indexURL })
    })
    return this.ready
  }

  private reset() {
    this.worker?.terminate()
    this.worker = null
    this.ready = null
    for (const [, entry] of this.pending) {
      window.clearTimeout(entry.timer)
      entry.resolve({ type: 'timeout' })
    }
    this.pending.clear()
  }

  private async send(message: Record<string, unknown>, timeoutMs: number): Promise<Reply> {
    const ok = await this.boot()
    if (!ok || !this.worker) return { type: 'boot_failed' }
    const id = ++this.seq
    const worker = this.worker
    return new Promise<Reply>((resolve) => {
      const timer = window.setTimeout(() => {
        this.pending.delete(id)
        resolve({ type: 'timeout' })
        this.reset()
      }, timeoutMs)
      this.pending.set(id, { resolve, timer })
      worker.postMessage({ ...message, id })
    })
  }

  async check(code: SubmissionCode): Promise<{ checks: CheckResult[]; error: string | null }> {
    const reply = await this.send({ type: 'check', ...code }, CHECK_TIMEOUT_MS)
    if (reply.type === 'checked') return { checks: asChecks(reply.checks), error: null }
    return { checks: [], error: replyError(reply) }
  }

  async run(
    code: SubmissionCode,
    puzzle: ZipPuzzle,
    limits: EngineLimits = GRADING_LIMITS,
  ): Promise<{ checks: CheckResult[]; result: EngineResult | null; error: string | null }> {
    const reply = await this.send(
      {
        type: 'run',
        ...code,
        board: puzzleToBoard(puzzle),
        maxExpansions: limits.maxExpansions,
        timeLimit: limits.timeLimitS,
      },
      limits.hardTimeoutMs,
    )
    if (reply.type === 'ran') {
      const traceBytes = reply.trace instanceof Uint8Array ? reply.trace : null
      return {
        checks: asChecks(reply.checks),
        result: reply.result ? asResult(reply.result, puzzle, traceBytes) : null,
        error: null,
      }
    }
    if (reply.type === 'timeout') {
      return {
        checks: [],
        result: {
          status: 'timeout',
          error: 'The run took too long and was stopped.',
          path: [],
          solved: false,
          stats: {},
          trace: null,
          traceBytes: null,
        },
        error: null,
      }
    }
    return { checks: [], result: null, error: replyError(reply) }
  }

  dispose() {
    this.reset()
  }
}

function replyError(reply: Reply): string {
  if (reply.type === 'boot_failed') return 'Could not start Python in this browser. Reload the page and try again.'
  if (reply.type === 'timeout') return 'The checks took too long and were stopped.'
  return reply.error ? `Python error: ${reply.error}` : 'Something went wrong while running the code.'
}
