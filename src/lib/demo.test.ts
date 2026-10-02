import { describe, expect, it } from 'vitest'
import raw from '../../public/demo/zip-demo.v1.json?raw'
import { replayLog } from '@/arena/referee'
import { jsonBytes, PUZZLE_BYTE_LIMIT, STEPS_BYTE_LIMIT, SUMMARY_BYTE_LIMIT } from '@/arena/replayContract'
import { DEMO_VERSION, type DemoZip } from '@/lib/demo'
import { wallKey } from '@/lib/vendor/zip-solver/solver'

const demo = JSON.parse(raw) as DemoZip

describe('demo zip', () => {
  it('re-simulates to the unique solution inside the column limits', () => {
    expect(demo.version).toBe(DEMO_VERSION)
    expect(demo.seed).toBe(demo.puzzle.seed)
    expect(demo.puzzle.rows).toBe(6)
    expect(demo.puzzle.cols).toBe(6)
    expect(demo.solution).toHaveLength(36)
    expect(demo.solution[0]).toBe(demo.puzzle.waypoints[0])
    expect(demo.solution.at(-1)).toBe(demo.puzzle.waypoints.at(-1))
    for (const wall of demo.puzzle.walls) {
      const [a, b] = wall.split('|').map(Number)
      expect(wall).toBe(wallKey(a!, b!))
    }
    expect(demo.steps.every(([op]) => op === 'm' || op === 'b')).toBe(true)
    expect(demo.summary.backtracks).toBeGreaterThan(0)

    const checked = replayLog(demo.puzzle, demo.steps)
    expect(checked.ok).toBe(true)
    expect(checked.status).toBe('solved')
    expect(checked.summary).toEqual(demo.summary)
    expect(demo.summary.solved).toBe(true)
    expect(checked.path).toEqual(demo.solution)
    expect(jsonBytes(demo.puzzle)).toBeLessThan(PUZZLE_BYTE_LIMIT)
    expect(jsonBytes(demo.steps)).toBeLessThan(STEPS_BYTE_LIMIT)
    expect(jsonBytes(demo.summary)).toBeLessThan(SUMMARY_BYTE_LIMIT)
  })
})
