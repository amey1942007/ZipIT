import { describe, expect, it } from 'vitest'
import { solve } from '@/lib/vendor/zip-solver/solver'
import { generatePuzzle, GenerateError, MIN_GRID, MAX_GRID } from '@/lib/zip/generate'

describe('generatePuzzle', () => {
  it('is deterministic for a seed', () => {
    const first = generatePuzzle({ seed: 11, rows: 5, cols: 5, timeBudgetMs: 8_000 })
    const second = generatePuzzle({ seed: 11, rows: 5, cols: 5, timeBudgetMs: 8_000 })
    expect(second).toEqual(first)
    expect(first.seed).toBe(11)
  })

  it('builds a unique puzzle on the default 6×6 and a 5×5', () => {
    for (const size of [5, 6] as const) {
      const puzzle = generatePuzzle({ seed: 4, rows: size, cols: size, timeBudgetMs: 8_000 })
      expect(puzzle.rows).toBe(size)
      expect(puzzle.cols).toBe(size)
      const found = solve(puzzle, { limit: 2, maxNodes: 200_000 })
      expect(found?.aborted).toBe(false)
      expect(found?.solutions).toHaveLength(1)
    }
  })

  it('rejects sizes outside 5×5 to 8×8', () => {
    expect(() => generatePuzzle({ seed: 1, rows: MIN_GRID - 1, cols: 5 })).toThrow(GenerateError)
    expect(() => generatePuzzle({ seed: 1, rows: MAX_GRID + 1, cols: 8 })).toThrow(GenerateError)
  })
})
