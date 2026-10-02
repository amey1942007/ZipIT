import { buildCostMap, numbersGrid } from '@/lib/zip/costMap'
import { cellIndex, cellRc, type RC, type ZipPuzzle } from '@/lib/zip/types'
import { buildNeighbors } from '@/lib/vendor/zip-solver/solver'
import { clampLimits, type RunLimits } from '@/arena/limits'
import {
  HARD_STEP_CAP,
  type ReplayPuzzle,
  type ReplayStep,
  type ReplaySummary,
  type StepOp,
} from '@/arena/replayContract'
import { replayScore } from '@/arena/scoreLocal'

export type { RC }
export type CostMap = (number | null)[][]

export interface GridView {
  rows: number
  cols: number
  numbers: number[][]
  neighbors(r: number, c: number): RC[]
  blocked(a: RC, b: RC): boolean
}

export interface Heuristic {
  id: string
  nextMove(grid: GridView, path: readonly RC[], cost: CostMap): RC
}

export type RunStatus =
  | 'solved'
  | 'exhausted'
  | 'timeout'
  | 'step_cap'
  | 'invalid_cap'
  | 'error'

export interface RunOutcome {
  puzzle: ReplayPuzzle
  steps: ReplayStep[]
  summary: ReplaySummary
  cutoff: boolean
  invalid: number
  status: RunStatus
  maxDepth: number
  scoreLocal: number
  error: string | null
  savable: boolean
}

interface Sim {
  path: number[]
  visited: Uint8Array
  nextWp: number
  bans: Array<Set<number>>
  consecutiveInvalid: number
  order: Int16Array
  neighbors: number[][]
  last: number
  total: number
}

function emptySummary(): ReplaySummary {
  return { moves: 0, backtracks: 0, time_ms: 0, solved: false }
}

function summarize(steps: readonly ReplayStep[], solved: boolean): ReplaySummary {
  let moves = 0
  let backtracks = 0
  for (const [op] of steps) {
    if (op === 'm') moves++
    else if (op === 'b') backtracks++
  }
  return {
    moves,
    backtracks,
    time_ms: steps.length ? steps[steps.length - 1]![3] : 0,
    solved,
  }
}

function makeSim(puzzle: ZipPuzzle): Sim | null {
  const { rows, cols, waypoints } = puzzle
  if (!waypoints || waypoints.length < 2) return null
  const total = rows * cols
  if (waypoints.some((cell) => !Number.isInteger(cell) || cell < 0 || cell >= total)) return null
  const order = new Int16Array(total)
  waypoints.forEach((cell, index) => {
    order[cell] = index + 1
  })
  const start = waypoints[0]!
  const visited = new Uint8Array(total)
  visited[start] = 1
  return {
    path: [start],
    visited,
    nextWp: 2,
    bans: [new Set(), new Set([start])],
    consecutiveInvalid: 0,
    order,
    neighbors: buildNeighbors(rows, cols, puzzle.walls),
    last: waypoints[waypoints.length - 1]!,
    total,
  }
}

function admissible(sim: Sim, cell: number): boolean {
  const number = sim.order[cell] ?? 0
  if (!number) return true
  if (number !== sim.nextWp) return false
  if (cell === sim.last && sim.path.length + 1 !== sim.total) return false
  return true
}

function legalMoves(sim: Sim): number[] {
  const head = sim.path[sim.path.length - 1]!
  const banned = sim.bans[sim.path.length] ?? new Set<number>()
  const out: number[] = []
  for (const next of sim.neighbors[head] ?? []) {
    if (sim.visited[next] || banned.has(next) || !admissible(sim, next)) continue
    out.push(next)
  }
  return out
}

function banSet(sim: Sim, depth: number): Set<number> {
  while (sim.bans.length <= depth) sim.bans.push(new Set())
  return sim.bans[depth]!
}

function backtrack(sim: Sim): number | null {
  if (sim.path.length <= 1) return null
  const removed = sim.path.pop()!
  sim.visited[removed] = 0
  if (sim.order[removed]) sim.nextWp--
  sim.bans.length = sim.path.length + 1
  banSet(sim, sim.path.length).add(removed)
  sim.consecutiveInvalid = 0
  return removed
}

function pushMove(sim: Sim, cell: number) {
  sim.visited[cell] = 1
  sim.path.push(cell)
  if (sim.order[cell]) sim.nextWp++
  sim.bans.length = sim.path.length
  banSet(sim, sim.path.length)
  sim.consecutiveInvalid = 0
}

function gridView(puzzle: ZipPuzzle): GridView {
  const neighbors = buildNeighbors(puzzle.rows, puzzle.cols, puzzle.walls)
  const wallSet = new Set(puzzle.walls)
  return {
    rows: puzzle.rows,
    cols: puzzle.cols,
    numbers: numbersGrid(puzzle),
    neighbors(r, c) {
      const index = cellIndex(r, c, puzzle.cols)
      return (neighbors[index] ?? []).map((next) => cellRc(next, puzzle.cols))
    },
    blocked(a, b) {
      const left = cellIndex(a[0], a[1], puzzle.cols)
      const right = cellIndex(b[0], b[1], puzzle.cols)
      const key = left < right ? `${left}|${right}` : `${right}|${left}`
      return wallSet.has(key)
    },
  }
}

function parseMove(value: RC | undefined): { ok: true; r: number; c: number } | { ok: false } {
  if (!value || value.length !== 2) return { ok: false }
  const [r, c] = value
  if (!Number.isInteger(r) || !Number.isInteger(c)) return { ok: false }
  return { ok: true, r, c }
}

export interface RunClock {
  now(): number
  timedOut(): boolean
}

export function runReferee(
  puzzle: ReplayPuzzle,
  heuristic: Heuristic,
  limitsInput?: Partial<RunLimits>,
  clock?: RunClock,
): RunOutcome {
  const limits = clampLimits(limitsInput)
  const sim = makeSim(puzzle)
  const steps: ReplayStep[] = []
  let maxDepth = sim?.path.length ?? 0
  let invalid = 0
  let status: RunStatus = 'exhausted'
  let error: string | null = null
  const t0 = clock?.now() ?? 0
  let lastT = 0
  const stamp = (): number => {
    const raw = Math.round((clock?.now() ?? t0) - t0)
    lastT = Math.max(lastT, raw)
    return lastT
  }

  const finish = (next: RunStatus, err: string | null = null): RunOutcome => {
    const solved = next === 'solved'
    return {
      puzzle: {
        rows: puzzle.rows,
        cols: puzzle.cols,
        waypoints: puzzle.waypoints.slice(),
        walls: puzzle.walls.slice(),
        seed: puzzle.seed,
      },
      steps,
      summary: summarize(steps, solved),
      cutoff: next === 'step_cap',
      invalid,
      status: next,
      maxDepth,
      scoreLocal: replayScore(maxDepth, puzzle.rows, puzzle.cols),
      error: err,
      savable: err == null && next !== 'error',
    }
  }

  if (!sim) return finish('error', 'malformed puzzle')
  const view = gridView(puzzle)
  const cap = Math.min(limits.max_steps, HARD_STEP_CAP)

  const emit = (op: StepOp, r: number, c: number): boolean => {
    steps.push([op, r, c, stamp()])
    return steps.length >= cap
  }

  try {
    while (steps.length < cap) {
      if (clock?.timedOut()) return finish('timeout')
      if (invalid >= limits.max_invalid) return finish('invalid_cap')
      const legal = legalMoves(sim)
      if (legal.length === 0) {
        if (sim.path.length === 1) return finish('exhausted')
        const removed = backtrack(sim)
        if (removed == null) return finish('exhausted')
        const [r, c] = cellRc(removed, puzzle.cols)
        if (emit('b', r, c)) return finish('step_cap')
        continue
      }
      let proposal: RC
      try {
        proposal = heuristic.nextMove(
          view,
          sim.path.map((cell) => cellRc(cell, puzzle.cols)),
          buildCostMap(puzzle, sim.path, sim.bans[sim.path.length] ?? new Set(), sim.nextWp),
        )
      } catch (err) {
        return finish('error', String(err instanceof Error ? err.message : err).slice(0, 500))
      }
      const parsed = parseMove(proposal)
      const target = parsed.ok ? cellIndex(parsed.r, parsed.c, puzzle.cols) : -1
      const legalPick = parsed.ok && legal.includes(target)
      if (!legalPick) {
        invalid++
        sim.consecutiveInvalid++
        const r = parsed.ok ? parsed.r : -1
        const c = parsed.ok ? parsed.c : -1
        if (emit('x', r, c)) return finish('step_cap')
        if (sim.consecutiveInvalid >= limits.max_consecutive_invalid) {
          if (sim.path.length === 1) return finish('exhausted')
          const removed = backtrack(sim)
          if (removed == null) return finish('exhausted')
          const rc = cellRc(removed, puzzle.cols)
          if (emit('b', rc[0], rc[1])) return finish('step_cap')
        }
        continue
      }
      pushMove(sim, target)
      maxDepth = Math.max(maxDepth, sim.path.length)
      const [r, c] = cellRc(target, puzzle.cols)
      if (sim.path.length === sim.total) {
        emit('m', r, c)
        return finish('solved')
      }
      if (emit('m', r, c)) return finish('step_cap')
    }
  } catch (err) {
    error = String(err instanceof Error ? err.message : err).slice(0, 500)
    status = 'error'
    return finish(status, error)
  }
  return finish(steps.length >= cap ? 'step_cap' : status)
}

export interface ReplayCheck {
  ok: boolean
  summary: ReplaySummary
  cutoff: boolean
  invalid: number
  status: RunStatus
  maxDepth: number
  path: number[]
  error: string | null
}

/** Re-simulate a log. A tampered move or backtrack fails the check. */
export function replayLog(puzzle: ReplayPuzzle, steps: readonly ReplayStep[]): ReplayCheck {
  const fail = (error: string): ReplayCheck => ({
    ok: false,
    summary: emptySummary(),
    cutoff: false,
    invalid: 0,
    status: 'error',
    maxDepth: 0,
    path: [],
    error,
  })
  const sim = makeSim(puzzle)
  if (!sim) return fail('malformed puzzle')
  let invalid = 0
  let maxDepth = sim.path.length
  let lastT = -1
  for (const step of steps) {
    if (!Array.isArray(step) || step.length !== 4) return fail('step shape')
    const [op, r, c, t] = step
    if (op !== 'm' && op !== 'b' && op !== 'x') return fail('step op')
    if (!Number.isInteger(r) || !Number.isInteger(c) || !Number.isInteger(t) || t < lastT) {
      return fail('step clock')
    }
    lastT = t
    const legal = new Set(legalMoves(sim))
    if ((op === 'm' || op === 'x') && sim.consecutiveInvalid >= 3 && sim.path.length > 1) {
      return fail('missing forced backtrack')
    }
    if (op === 'm') {
      if (r < 0 || c < 0) return fail('illegal move')
      const target = cellIndex(r, c, puzzle.cols)
      if (!legal.has(target)) return fail('illegal move')
      pushMove(sim, target)
      maxDepth = Math.max(maxDepth, sim.path.length)
      continue
    }
    if (op === 'x') {
      if (legal.size === 0) return fail('invalid pick at a dead end')
      const malformed = r === -1 && c === -1
      const target = malformed ? -1 : cellIndex(r, c, puzzle.cols)
      if (!malformed && legal.has(target)) return fail('valid move recorded as invalid')
      invalid++
      sim.consecutiveInvalid++
      continue
    }
    const head = sim.path[sim.path.length - 1]!
    const [hr, hc] = cellRc(head, puzzle.cols)
    if (r !== hr || c !== hc) return fail('backtrack cell')
    const forced = sim.consecutiveInvalid >= 3
    const dead = legal.size === 0
    if (!forced && !dead) return fail('unexpected backtrack')
    if (sim.path.length <= 1) return fail('backtrack past start')
    backtrack(sim)
  }
  const solved = sim.path.length === sim.total
  let status: RunStatus = 'exhausted'
  if (solved) status = 'solved'
  else if (steps.length >= HARD_STEP_CAP) status = 'step_cap'
  else if (invalid >= 2_000) status = 'invalid_cap'
  return {
    ok: true,
    summary: summarize(steps, solved),
    cutoff: steps.length >= HARD_STEP_CAP && !solved,
    invalid,
    status,
    maxDepth,
    path: sim.path.slice(),
    error: null,
  }
}
