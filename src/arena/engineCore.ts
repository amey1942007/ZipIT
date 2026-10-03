import type { ReplayStep } from '@/arena/replayContract'
import { cellIndex, cellRc, type ZipPuzzle } from '@/lib/zip/types'

/** Same limits as ZipIt_ARIES config/engine.json. */
export const ENGINE_MAX_EXPANSIONS = 200_000
export const ENGINE_TIME_LIMIT_S = 20
/** The engine checks its clock every 1024 expansions; this catches a score() that never returns. */
export const ENGINE_HARD_TIMEOUT_MS = 35_000

export type CheckId = 'syntax' | 'imports' | 'classes' | 'output' | 'smoke'
export const CHECK_ORDER: CheckId[] = ['syntax', 'imports', 'classes', 'output', 'smoke']
export const CHECK_LABELS: Record<CheckId, string> = {
  syntax: 'Syntax',
  imports: 'Imports',
  classes: 'Score + TieBreaker',
  output: 'Output format',
  smoke: '3×3 warm-up',
}

export interface CheckResult {
  id: CheckId
  ok: boolean
  message: string
}

export type EngineStatus = 'solved' | 'exhausted' | 'expansion_limit' | 'time_limit' | 'error' | 'timeout'

export interface EngineStats {
  expansions?: number
  generated?: number
  pruned?: number
  dead_ends?: number
  backtracks?: number
  tiebreaks?: number
  duplicates?: number
  elapsed?: number
}

export interface EngineResult {
  status: EngineStatus
  error: string | null
  /** Flat cell indices: the solution, or the deepest path reached when unsolved. */
  path: number[]
  solved: boolean
  stats: EngineStats
}

export interface SubmissionCode {
  search: string
  tiebreaker: string
}

export interface EngineBoard {
  id: string
  width: number
  height: number
  checkpoints: number[][]
  walls: number[][][]
}

export const STATUS_LABELS: Record<EngineStatus, string> = {
  solved: 'Solved',
  exhausted: 'No path found',
  expansion_limit: `Stopped at ${ENGINE_MAX_EXPANSIONS.toLocaleString('en-IN')} expansions`,
  time_limit: `Stopped at the ${ENGINE_TIME_LIMIT_S} s limit`,
  error: 'Crashed',
  timeout: 'Timed out',
}

export function puzzleToBoard(puzzle: ZipPuzzle, id = 'arena'): EngineBoard {
  const walls: number[][][] = []
  for (const key of puzzle.walls) {
    const [a, b] = key.split('|').map(Number)
    if (a === undefined || b === undefined || Number.isNaN(a) || Number.isNaN(b)) continue
    walls.push([[...cellRc(a, puzzle.cols)], [...cellRc(b, puzzle.cols)]])
  }
  return {
    id,
    width: puzzle.cols,
    height: puzzle.rows,
    checkpoints: puzzle.waypoints.map((cell) => [...cellRc(cell, puzzle.cols)]),
    walls,
  }
}

function wallKey(a: number, b: number): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`
}

/** TypeScript twin of zipcomp.game.validate_solution. */
export function validSolution(puzzle: ZipPuzzle, path: readonly number[]): boolean {
  const total = puzzle.rows * puzzle.cols
  if (path.length !== total || new Set(path).size !== total) return false
  if (path[0] !== puzzle.waypoints[0] || path[path.length - 1] !== puzzle.waypoints[puzzle.waypoints.length - 1]) return false
  const walls = new Set(puzzle.walls)
  for (let i = 1; i < path.length; i++) {
    const [ar, ac] = cellRc(path[i - 1]!, puzzle.cols)
    const [br, bc] = cellRc(path[i]!, puzzle.cols)
    if (Math.abs(ar - br) + Math.abs(ac - bc) !== 1) return false
    if (walls.has(wallKey(path[i - 1]!, path[i]!))) return false
  }
  const order = path.filter((cell) => puzzle.waypoints.includes(cell)).map((cell) => puzzle.waypoints.indexOf(cell))
  return order.every((value, index) => value === index)
}

/** Playback log for a path. The start cell is implicit (see frameAt). */
export function pathSteps(path: readonly number[], cols: number): ReplayStep[] {
  return path.slice(1).map((cell, index) => {
    const [r, c] = cellRc(cell, cols)
    return ['m', r, c, index + 1]
  })
}

export function formatElapsed(seconds: number | undefined): string {
  if (typeof seconds !== 'number' || !Number.isFinite(seconds)) return '—'
  return seconds < 1 ? `${(seconds * 1000).toFixed(1)} ms` : `${seconds.toFixed(2)} s`
}

export function checksPassed(checks: readonly CheckResult[] | null): boolean {
  return Boolean(checks && checks.length === CHECK_ORDER.length && checks.every((item) => item.ok))
}

export function asChecks(value: unknown): CheckResult[] {
  if (!Array.isArray(value)) return []
  return value
    .filter((item): item is CheckResult => Boolean(item) && CHECK_ORDER.includes((item as CheckResult).id))
    .map((item) => ({ id: item.id, ok: item.ok === true, message: String(item.message ?? '').slice(0, 400) }))
}

/** Validates the worker's reply on the main thread; a "solved" path that breaks the rules is an error. */
export function asResult(value: unknown, puzzle: ZipPuzzle): EngineResult {
  const raw = (value ?? {}) as { status?: string; error?: string | null; path?: unknown; stats?: EngineStats }
  const status = (Object.keys(STATUS_LABELS) as EngineStatus[]).includes(raw.status as EngineStatus)
    ? (raw.status as EngineStatus)
    : 'error'
  const path = Array.isArray(raw.path)
    ? raw.path
        .filter((rc): rc is number[] => Array.isArray(rc) && rc.length === 2 && rc.every(Number.isInteger))
        .map(([r, c]) => cellIndex(r!, c!, puzzle.cols))
    : []
  const solved = status === 'solved' && validSolution(puzzle, path)
  return {
    status: status === 'solved' && !solved ? 'error' : status,
    error: status === 'solved' && !solved ? 'The engine reported a path that breaks the rules.' : (raw.error ?? null),
    path,
    solved,
    stats: raw.stats && typeof raw.stats === 'object' ? raw.stats : {},
  }
}
