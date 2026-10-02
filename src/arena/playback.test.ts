import { describe, expect, it } from 'vitest'
import raw from '../../public/demo/zip-demo.v1.json?raw'
import { BOARD_PAD, boardOuterWidth, cellSize, polylinePoints } from '@/arena/boardGeometry'
import { frameAt } from '@/arena/playback'
import { replayLog } from '@/arena/referee'
import type { DemoZip } from '@/lib/demo'

const demo = JSON.parse(raw) as DemoZip
const cell = 84

function pointsAt(index: number) {
  return polylinePoints(frameAt(demo.puzzle, demo.steps, index).path, demo.puzzle.cols, cell)
}

describe('playback', () => {
  it('places the head on waypoint 1 before step 0, then matches the referee', () => {
    const start = frameAt(demo.puzzle, demo.steps, 0)
    expect(demo.steps[0]?.[0]).toBe('m')
    expect(start.path).toEqual([demo.puzzle.waypoints[0]])
    expect(start.head).toBe(demo.puzzle.waypoints[0])

    const done = frameAt(demo.puzzle, demo.steps, demo.steps.length)
    const checked = replayLog(demo.puzzle, demo.steps)
    expect(done.path).toEqual(checked.path)
    expect(done.head).toBe(demo.puzzle.waypoints.at(-1))
  })

  it('builds polyline points at step 0, after a backtrack, and at the end', () => {
    const start = demo.puzzle.waypoints[0]!
    const startCol = start % demo.puzzle.cols
    const startRow = Math.floor(start / demo.puzzle.cols)
    expect(pointsAt(0)).toEqual([[startCol * cell + cell / 2, startRow * cell + cell / 2]])

    const back = demo.steps.findIndex((step) => step[0] === 'b')
    expect(back).toBeGreaterThan(0)
    const before = pointsAt(back)
    const after = pointsAt(back + 1)
    expect(after).toEqual(before.slice(0, -1))
    expect(after.length).toBe(before.length - 1)

    const done = pointsAt(demo.steps.length)
    const checked = replayLog(demo.puzzle, demo.steps)
    expect(done).toEqual(polylinePoints(checked.path, demo.puzzle.cols, cell))
    expect(done[0]).toEqual(pointsAt(0)[0])
    expect(done).toHaveLength(demo.solution.length)
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
