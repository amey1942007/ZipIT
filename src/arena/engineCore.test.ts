import { describe, expect, it } from 'vitest'
import { asResult, checksPassed, pathSteps, puzzleToBoard, validSolution } from '@/arena/engineCore'
import { frameAt } from '@/arena/playback'
import type { ZipPuzzle } from '@/lib/zip/types'

/** 2×3 board with a wall between cells 1 and 4; the only route is 0 1 2 5 4 3. */
const puzzle: ZipPuzzle = { rows: 2, cols: 3, waypoints: [0, 2, 3], walls: ['1|4'] }

describe('engine board conversion', () => {
  it('maps waypoints and wall keys to the ZipIt_ARIES board dict', () => {
    expect(puzzleToBoard(puzzle, 'b1')).toEqual({
      id: 'b1',
      width: 3,
      height: 2,
      checkpoints: [[0, 0], [0, 2], [1, 0]],
      walls: [[[0, 1], [1, 1]]],
    })
  })
})

describe('solution check', () => {
  it('accepts the legal path and rejects walls, gaps, order and coverage problems', () => {
    expect(validSolution(puzzle, [0, 1, 2, 5, 4, 3])).toBe(true)
    expect(validSolution(puzzle, [0, 1, 4, 5, 2, 3])).toBe(false)
    expect(validSolution(puzzle, [0, 1, 2, 5, 4])).toBe(false)
    expect(validSolution({ ...puzzle, waypoints: [0, 4, 3] }, [0, 1, 2, 5, 4, 3])).toBe(true)
    expect(validSolution({ ...puzzle, waypoints: [0, 5, 2, 3] }, [0, 1, 2, 5, 4, 3])).toBe(false)
  })

  it('downgrades a "solved" reply whose path breaks the rules', () => {
    const good = asResult({ status: 'solved', path: [[0, 0], [0, 1], [0, 2], [1, 2], [1, 1], [1, 0]], stats: { expansions: 6 } }, puzzle)
    expect(good.solved).toBe(true)
    expect(good.stats.expansions).toBe(6)
    const bad = asResult({ status: 'solved', path: [[0, 0], [0, 1], [1, 1]] }, puzzle)
    expect(bad.solved).toBe(false)
    expect(bad.status).toBe('error')
    expect(asResult({ status: 'nonsense' }, puzzle).status).toBe('error')
  })
})

describe('playback steps', () => {
  it('replays a solution path cell by cell', () => {
    const steps = pathSteps([0, 1, 2, 5, 4, 3], 3)
    expect(steps).toHaveLength(5)
    expect(frameAt({ ...puzzle, seed: 0 }, steps, steps.length).path).toEqual([0, 1, 2, 5, 4, 3])
  })

  it('needs all five checks to pass', () => {
    const ok = (id: string) => ({ id, ok: true, message: '' }) as never
    expect(checksPassed(null)).toBe(false)
    expect(checksPassed([ok('syntax')])).toBe(false)
    expect(checksPassed(['syntax', 'imports', 'classes', 'output', 'smoke'].map(ok))).toBe(true)
  })
})
