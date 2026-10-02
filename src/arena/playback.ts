import { replayScore } from '@/arena/scoreLocal'
import type { ReplayPuzzle, ReplayStep } from '@/arena/replayContract'

export interface PlaybackFrame {
  path: number[]
  backtracked: number[]
  head: number | null
  waypointsReached: number
  maxDepth: number
  score: number
  invalidCell: number | null
}

/** Step 0 is before any logged move. The log does not contain the start cell. */
export function frameAt(puzzle: ReplayPuzzle, steps: readonly ReplayStep[], index: number): PlaybackFrame {
  const start = puzzle.waypoints[0] ?? 0
  const path = [start]
  const backtracked: number[] = []
  let maxDepth = 1
  let invalidCell: number | null = null
  const end = Math.max(0, Math.min(index, steps.length))
  for (let i = 0; i < end; i++) {
    const step = steps[i]
    if (!step) continue
    const [op, row, col] = step
    const cell = row * puzzle.cols + col
    invalidCell = null
    if (op === 'm') {
      path.push(cell)
      maxDepth = Math.max(maxDepth, path.length)
    } else if (op === 'b') {
      const removed = path.pop()
      if (removed !== undefined) backtracked.push(removed)
    } else if (op === 'x') {
      invalidCell = cell
    }
  }
  const reached = puzzle.waypoints.filter((cell) => path.includes(cell)).length
  return {
    path,
    backtracked,
    head: path[path.length - 1] ?? null,
    waypointsReached: reached,
    maxDepth,
    score: replayScore(maxDepth, puzzle.rows, puzzle.cols),
    invalidCell,
  }
}
