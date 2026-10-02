import { describe, expect, it } from 'vitest'
import { HARD_STEP_CAP, replayInsert, summaryKeys, puzzleKeys } from '@/arena/replayContract'
import { replayLog, runReferee, type Heuristic, type RC } from '@/arena/referee'
import { placeholderHeuristic } from '@/arena/placeholder'
import { REPLAY_SCORE_LABEL, replayScoreReadout } from '@/arena/scoreLocal'
import { generatePuzzle } from '@/lib/zip/generate'
import type { ReplayPuzzle } from '@/arena/replayContract'

function open(seed = 1): ReplayPuzzle {
  return {
    rows: 5,
    cols: 5,
    waypoints: [0, 4],
    walls: [],
    seed,
  }
}

describe('referee', () => {
  it('records a legal move and ignores an illegal one', () => {
    let calls = 0
    const heuristic: Heuristic = {
      id: 'scripted',
      nextMove() {
        calls++
        if (calls === 1) return [0, 1]
        return [4, 4]
      },
    }
    const outcome = runReferee(open(), heuristic, { max_steps: 4, max_invalid: 5 })
    expect(outcome.steps[0]).toEqual(['m', 0, 1, 0])
    expect(outcome.steps[1]?.[0]).toBe('x')
    expect(outcome.steps[1]?.[1]).toBe(4)
    expect(outcome.summary.moves).toBeGreaterThanOrEqual(1)
    expect(outcome.invalid).toBeGreaterThanOrEqual(1)
  })

  it('counts only a path shrink as a backtrack, after three invalid picks', () => {
    let calls = 0
    const heuristic: Heuristic = {
      id: 'strikes',
      nextMove(): RC {
        calls++
        if (calls === 1) return [0, 1]
        return [-1, -1]
      },
    }
    const outcome = runReferee(open(), heuristic, { max_steps: 20, max_invalid: 20 })
    const ops = outcome.steps.map((step) => step[0])
    expect(ops.slice(0, 5)).toEqual(['m', 'x', 'x', 'x', 'b'])
    expect(outcome.summary.backtracks).toBeGreaterThanOrEqual(1)
    expect(outcome.steps[4]?.[1]).toBe(0)
    expect(outcome.steps[4]?.[2]).toBe(1)
    const checked = replayLog(outcome.puzzle, outcome.steps)
    expect(checked.ok).toBe(true)
  })

  it('hard-stops at 15,000 steps and marks the run cut off', () => {
    const cursor = new Map<string, number>()
    const heuristic: Heuristic = {
      id: 'wander',
      nextMove(grid, path) {
        const [r, c] = path[path.length - 1]!
        const seen = new Set(path.map(([pr, pc]) => `${pr},${pc}`))
        const open = grid.neighbors(r, c).filter(([nr, nc]) => !seen.has(`${nr},${nc}`))
        const key = path.map(([pr, pc]) => `${pr},${pc}`).join('|')
        const n = cursor.get(key) ?? 0
        cursor.set(key, n + 1)
        if (open.length === 0) return [r, c]
        return open[n % open.length]!
      },
    }
    const puzzle: ReplayPuzzle = { rows: 8, cols: 8, waypoints: [0, 7], walls: [], seed: 9 }
    const outcome = runReferee(puzzle, heuristic)
    expect(outcome.steps).toHaveLength(HARD_STEP_CAP)
    expect(outcome.cutoff).toBe(true)
    expect(outcome.status).toBe('step_cap')
    expect(outcome.summary.solved).toBe(false)
    expect(summaryKeys(outcome.summary)).toEqual(['backtracks', 'moves', 'solved', 'time_ms'])
  })

  it('rejects a tampered log', () => {
    const puzzle = generatePuzzle({ seed: 3, rows: 5, cols: 5, timeBudgetMs: 8_000 })
    const outcome = runReferee(puzzle, placeholderHeuristic, { max_steps: 400, timeout_ms: 5_000 })
    const checked = replayLog(puzzle, outcome.steps)
    expect(checked.ok).toBe(true)
    const tampered = outcome.steps.map((step) => [...step] as typeof step)
    const move = tampered.findIndex((step) => step[0] === 'm')
    expect(move).toBeGreaterThanOrEqual(0)
    tampered[move] = ['m', 0, 0, tampered[move]![3]]
    expect(replayLog(puzzle, tampered).ok).toBe(false)
  })

  it('shapes a savable row for the replays table and labels the local score', () => {
    const puzzle = generatePuzzle({ seed: 8, rows: 5, cols: 5, timeBudgetMs: 8_000 })
    const outcome = runReferee(puzzle, placeholderHeuristic, { max_steps: 500 })
    expect(puzzleKeys(outcome.puzzle)).toEqual(['cols', 'rows', 'seed', 'walls', 'waypoints'])
    expect(summaryKeys(outcome.summary)).toEqual(['backtracks', 'moves', 'solved', 'time_ms'])
    const row = replayInsert({
      submissionId: '00000000-0000-4000-8000-000000000001',
      teamId: '00000000-0000-4000-8000-000000000002',
      puzzle: outcome.puzzle,
      steps: outcome.steps,
      summary: outcome.summary,
    })
    expect(row.submission_id).toBe('00000000-0000-4000-8000-000000000001')
    expect(row.puzzle).toEqual(outcome.puzzle)
    const readout = replayScoreReadout(outcome.maxDepth, puzzle.rows, puzzle.cols)
    expect(readout.label).toBe(REPLAY_SCORE_LABEL)
    expect(readout.label).toBe('replay score')
    expect(readout.official).toBe(false)
    expect(readout.value).toBe(outcome.scoreLocal)
  })
})
