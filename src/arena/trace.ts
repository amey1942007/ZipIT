import { TRACE_BACKTRACK, TRACE_TIE, type EngineTrace } from '@/arena/engineCore'

/** Per-expansion lookups computed once per trace, so seeking anywhere stays O(depth). */
export interface TraceIndex {
  trace: EngineTrace
  size: number
  /** Backtracks counted up to and including expansion k. */
  backtracksSoFar: Int32Array
  /** The latest expansion ≤ k that jumped to another branch, or -1. */
  lastJump: Int32Array
  totalBacktracks: number
}

export interface TraceFrame {
  /** Path of the node expanded at this step, start cell first. */
  path: number[]
  /** Cells of the branch the search most recently gave up that are not on the current path. */
  abandoned: number[]
  head: number | null
  jumped: boolean
  tie: boolean
  score: number
  backtracksSoFar: number
  waypointsReached: number
}

export function indexTrace(trace: EngineTrace): TraceIndex {
  const size = trace.heads.length
  const backtracksSoFar = new Int32Array(size)
  const lastJump = new Int32Array(size)
  let count = 0
  let jump = -1
  for (let k = 0; k < size; k++) {
    if (trace.flags[k]! & TRACE_BACKTRACK) {
      count += 1
      jump = k
    }
    backtracksSoFar[k] = count
    lastJump[k] = jump
  }
  return { trace, size, backtracksSoFar, lastJump, totalBacktracks: count }
}

export function nodePath(trace: EngineTrace, k: number): number[] {
  const out: number[] = []
  for (let i = k; i >= 0; i = trace.parents[i]!) out.push(trace.heads[i]!)
  return out.reverse()
}

export function traceFrame(index: TraceIndex, k: number, waypoints: readonly number[]): TraceFrame {
  const { trace } = index
  const at = Math.max(0, Math.min(k, index.size - 1))
  const path = nodePath(trace, at)
  const onPath = new Set(path)
  const jump = index.lastJump[at]!
  let abandoned: number[] = []
  if (jump > 0) {
    const before = nodePath(trace, jump - 1)
    const after = nodePath(trace, jump)
    let shared = 0
    while (shared < before.length && shared < after.length && before[shared] === after[shared]) shared += 1
    abandoned = before.slice(shared).filter((cell) => !onPath.has(cell))
  }
  return {
    path,
    abandoned,
    head: path[path.length - 1] ?? null,
    jumped: jump === at && at > 0,
    tie: Boolean(trace.flags[at]! & TRACE_TIE),
    score: trace.scores[at]!,
    backtracksSoFar: index.backtracksSoFar[at]!,
    waypointsReached: waypoints.filter((cell) => onPath.has(cell)).length,
  }
}
