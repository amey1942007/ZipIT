import { describe, expect, it } from 'vitest'
import { asResult } from '@/arena/engineCore'
import { asSavedPuzzle, replayKeepIds, replaySummary } from '@/lib/arenaReplays'
import type { SlotSubmission } from '@/lib/slots'

const puzzle = { rows: 2, cols: 3, waypoints: [0, 2, 3], walls: ['1|4'], seed: 7 }

function row(id: string, status: string, score: number | null, created_at: string): SlotSubmission {
  return { id, status, score, created_at, error: null, file_name: 'x.py', scored_at: null }
}

describe('saved replays', () => {
  it('keeps replays for the BEST, 2ND, 3RD and LATEST runs only', () => {
    const rows = [
      row('a', 'scored', 10, '2026-10-01T00:00:00Z'),
      row('b', 'scored', 40, '2026-10-01T01:00:00Z'),
      row('c', 'scored', 30, '2026-10-01T02:00:00Z'),
      row('d', 'scored', 20, '2026-10-01T03:00:00Z'),
      row('e', 'failed', null, '2026-10-01T04:00:00Z'),
    ]
    expect(replayKeepIds(rows)).toEqual(['b', 'c', 'd', 'e'])
    expect(replayKeepIds(rows.slice(0, 2))).toEqual(['b', 'a'])
    expect(replayKeepIds([])).toEqual([])
  })

  it('stores a summary that reads back as the same result', () => {
    const result = asResult(
      { status: 'solved', path: [[0, 0], [0, 1], [0, 2], [1, 2], [1, 1], [1, 0]], stats: { expansions: 6, elapsed: 0.2 } },
      puzzle,
    )
    const summary = JSON.parse(JSON.stringify(replaySummary(result, puzzle.cols)))
    const back = asResult(summary, puzzle)
    expect(back.solved).toBe(true)
    expect(back.path).toEqual(result.path)
    expect(back.stats).toEqual(result.stats)
  })

  it('accepts only well-formed saved boards', () => {
    expect(asSavedPuzzle(puzzle)).toEqual(puzzle)
    expect(asSavedPuzzle({ ...puzzle, seed: undefined })?.seed).toBe(0)
    expect(asSavedPuzzle(null)).toBeNull()
    expect(asSavedPuzzle({ ...puzzle, rows: 1 })).toBeNull()
    expect(asSavedPuzzle({ ...puzzle, waypoints: [0, 6] })).toBeNull()
    expect(asSavedPuzzle({ ...puzzle, waypoints: [0] })).toBeNull()
    expect(asSavedPuzzle({ ...puzzle, walls: ['1-4'] })).toBeNull()
  })
})
