import { describe, expect, it } from 'vitest'
import { BOARD_PAD, boardOuterWidth, cellSize, polylinePoints } from '@/arena/boardGeometry'
import { frameAt } from '@/arena/playback'
import type { ReplayPuzzle, ReplayStep } from '@/arena/replayContract'

/** 2×3 board, path 0 → 1 → 2 → 5 → 4 → 3 with one backtrack on the way. */
const puzzle: ReplayPuzzle = { rows: 2, cols: 3, waypoints: [0, 3], walls: [], seed: 1 }
const steps: ReplayStep[] = [
  ['m', 0, 1, 1],
  ['m', 1, 1, 2],
  ['b', 1, 1, 3],
  ['m', 0, 2, 4],
  ['m', 1, 2, 5],
  ['m', 1, 1, 6],
  ['m', 1, 0, 7],
]
const cell = 84

function pointsAt(index: number) {
  return polylinePoints(frameAt(puzzle, steps, index).path, puzzle.cols, cell)
}

describe('playback', () => {
  it('places the head on waypoint 1 before step 0 and ends on the last waypoint', () => {
    const start = frameAt(puzzle, steps, 0)
    expect(start.path).toEqual([0])
    expect(start.head).toBe(0)
    const done = frameAt(puzzle, steps, steps.length)
    expect(done.path).toEqual([0, 1, 2, 5, 4, 3])
    expect(done.head).toBe(3)
    expect(done.waypointsReached).toBe(2)
    expect(done.backtracked).toEqual([4])
  })

  it('builds polyline points at step 0, after a backtrack, and at the end', () => {
    expect(pointsAt(0)).toEqual([[cell / 2, cell / 2]])
    const before = pointsAt(2)
    const after = pointsAt(3)
    expect(after).toEqual(before.slice(0, -1))
    expect(pointsAt(steps.length)).toHaveLength(6)
  })
})

describe('board size', () => {
  it('uses 52px cells on a phone and 84px on a wide desktop for 6×6', () => {
    expect(cellSize(6, 'mobile', 390 - 32)).toBe(52)
    expect(cellSize(6, 'desktop', 1200)).toBe(84)
    expect(boardOuterWidth(6, 84)).toBe(6 * 84 + 2 * BOARD_PAD)
    expect(boardOuterWidth(6, 84)).toBe(528)
    expect(boardOuterWidth(6, cellSize(6, 'mobile', 358))).toBeLessThanOrEqual(358)
    expect(cellSize(6, 'desktop', 80)).toBe(32)
  })
})
