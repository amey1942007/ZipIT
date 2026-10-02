import runtimeSource from '@/workers/zipit_runtime.py?raw'
import { clampLimits, gridWithinCap, type RunLimits } from '@/arena/limits'
import { runReferee, type Heuristic, type RC } from '@/arena/referee'
import type { ReplayPuzzle, ReplayStep } from '@/arena/replayContract'
import { lockdown } from '@/workers/lockdown'

interface PyProxy {
  runPython: (code: string) => unknown
  globals: { set: (name: string, value: unknown) => void }
  destroy?: () => void
}

type LoadPyodide = (opts: {
  indexURL: string
  packageBaseUrl: string
  jsglobals: Record<string, never>
  env: Record<string, string>
  stdout: (chunk: string) => void
  stderr: (chunk: string) => void
  packages: string[]
}) => Promise<PyProxy>

const scope = self as unknown as {
  postMessage: (data: unknown) => void
  onmessage: ((event: MessageEvent<unknown>) => void) | null
}

function cap(limit: number): (chunk: string) => void {
  let used = 0
  return (chunk) => {
    used += chunk.length
    if (used > limit) used = limit
  }
}

function postJson(message: unknown) {
  scope.postMessage(JSON.parse(JSON.stringify(message)))
}

let py: PyProxy | null = null

function wallPairs(puzzle: ReplayPuzzle): number[][][] {
  const pairs: number[][][] = []
  for (const key of puzzle.walls) {
    const [left, right] = key.split('|').map(Number)
    if (left === undefined || right === undefined) continue
    const a: RC = [Math.floor(left / puzzle.cols), left % puzzle.cols]
    const b: RC = [Math.floor(right / puzzle.cols), right % puzzle.cols]
    pairs.push([[a[0], a[1]], [b[0], b[1]]])
  }
  return pairs
}

function numbers(puzzle: ReplayPuzzle): number[][] {
  const grid = Array.from({ length: puzzle.rows }, () => Array.from({ length: puzzle.cols }, () => 0))
  puzzle.waypoints.forEach((cell, index) => {
    grid[Math.floor(cell / puzzle.cols)]![cell % puzzle.cols] = index + 1
  })
  return grid
}

scope.onmessage = (event: MessageEvent<unknown>) => {
  const data = typeof event.data === 'string' ? event.data : JSON.stringify(event.data)
  let message: { type?: string; indexURL?: string; code?: string; puzzle?: ReplayPuzzle; limits?: Partial<RunLimits>; seed?: number }
  try {
    message = JSON.parse(data) as typeof message
  } catch {
    return
  }
  if (message.type === 'init' && message.indexURL) {
    void boot(message.indexURL)
    return
  }
  if (message.type === 'run' && py && message.puzzle && typeof message.code === 'string') {
    run(message.code, message.puzzle, message.limits, message.seed ?? 0)
  }
}

async function boot(indexURL: string) {
  try {
    const href = indexURL.endsWith('/') ? indexURL : `${indexURL}/`
    const mod = (await import(/* @vite-ignore */ `${href}pyodide.mjs`)) as { loadPyodide: LoadPyodide }
    py = await mod.loadPyodide({
      indexURL: href,
      packageBaseUrl: href,
      jsglobals: {},
      env: { PYTHONHASHSEED: '0' },
      stdout: cap(64_000),
      stderr: cap(64_000),
      packages: [],
    })
    py.globals.set('_RUNTIME', runtimeSource)
    py.runPython('_exec_runtime = exec; _exec_runtime(_RUNTIME)')
    lockdown(scope)
    postJson({ type: 'ready' })
  } catch (err) {
    postJson({ type: 'error', error: String(err instanceof Error ? err.message : err).slice(0, 500) })
  }
}

function run(code: string, puzzle: ReplayPuzzle, limits: Partial<RunLimits> | undefined, seed: number) {
  if (!py) return
  if (!gridWithinCap(puzzle.rows, puzzle.cols) || code.length > 262_144) {
    postJson({ type: 'done', steps: [], status: 'error', error: 'cap' })
    return
  }
  const active = py
  try {
    active.globals.set('_USER_CODE', code)
    active.runPython('_install_user(_USER_CODE)')
    active.runPython(`_load(${JSON.stringify(numbers(puzzle))}, ${JSON.stringify(wallPairs(puzzle))}, ${puzzle.rows}, ${puzzle.cols})`)
    active.runPython(`_seed(${seed >>> 0})`)
  } catch (err) {
    postJson({
      type: 'done',
      steps: [],
      status: 'error',
      error: String(err instanceof Error ? err.message : err).slice(0, 500),
    })
    return
  }
  const started = performance.now()
  const bounded = clampLimits(limits)
  let pending: ReplayStep[] = []
  let lastFlush = started
  const flush = (force: boolean) => {
    const now = performance.now()
    if (pending.length >= 500 || (pending.length > 0 && now - lastFlush >= 250) || force) {
      postJson({ type: 'chunk', steps: pending })
      pending = []
      lastFlush = now
    }
  }
  const heuristic: Heuristic = {
    id: 'py',
    nextMove(_grid, path, cost) {
      active.globals.set('_PATH_JSON', JSON.stringify(path))
      active.globals.set('_COST_JSON', JSON.stringify(cost))
      const raw = String(active.runPython('_call()'))
      const parsed = JSON.parse(raw) as unknown
      if (parsed && typeof parsed === 'object' && parsed !== null && 'error' in parsed) {
        throw new Error(String((parsed as { error: string }).error))
      }
      if (!Array.isArray(parsed) || parsed.length !== 2) return [-1, -1]
      return [Number(parsed[0]), Number(parsed[1])] as RC
    },
  }
  const outcome = runReferee(puzzle, heuristic, bounded, {
    now: () => performance.now(),
    timedOut: () => performance.now() - started > bounded.timeout_ms,
  })
  for (const step of outcome.steps) {
    pending.push(step)
    flush(false)
  }
  flush(true)
  postJson({
    type: 'done',
    status: outcome.status,
    error: outcome.error,
  })
}
