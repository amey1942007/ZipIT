import type { Json, TablesInsert } from '@/lib/database.types'
import type { ZipPuzzle } from '@/lib/zip/types'

/**
 * Column shapes from the integration guide (§6) and `replays` in 001_init.sql.
 * puzzle: {rows, cols, waypoints, walls, seed}
 * steps: [[op, r, c, t_ms], ...]
 * summary: {moves, backtracks, time_ms, solved}
 *
 * `'x'` is the arena invalid-pick op. The guide names `'m'` and `'b'`; the
 * tuple layout is the same, so an invalid pick still fits the jsonb column
 * and can be re-simulated before a row would be saved.
 */
export type StepOp = 'm' | 'b' | 'x'

export type ReplayStep = [op: StepOp, r: number, c: number, t_ms: number]

export interface ReplayPuzzle extends ZipPuzzle {
  seed: number
}

export interface ReplaySummary {
  moves: number
  backtracks: number
  time_ms: number
  solved: boolean
}

export const REPLAY_PUZZLE_KEYS = ['rows', 'cols', 'waypoints', 'walls', 'seed'] as const
export const REPLAY_SUMMARY_KEYS = ['moves', 'backtracks', 'time_ms', 'solved'] as const

export const HARD_STEP_CAP = 15_000
export const PUZZLE_BYTE_LIMIT = 65_536
export const STEPS_BYTE_LIMIT = 1_048_576
export const SUMMARY_BYTE_LIMIT = 16_384

export function puzzleKeys(puzzle: ReplayPuzzle): string[] {
  return Object.keys(puzzle).sort()
}

export function summaryKeys(summary: ReplaySummary): string[] {
  return Object.keys(summary).sort()
}

export interface ReplayDraft {
  submissionId: string
  teamId: string
  puzzle: ReplayPuzzle
  steps: ReplayStep[]
  summary: ReplaySummary
}

export function replayInsert(draft: ReplayDraft): TablesInsert<'replays'> {
  return {
    submission_id: draft.submissionId,
    team_id: draft.teamId,
    puzzle: draft.puzzle as unknown as Json,
    steps: draft.steps as unknown as Json,
    summary: draft.summary as unknown as Json,
  }
}

export function jsonBytes(value: unknown): number {
  return JSON.stringify(value).length
}

export function withinColumnLimits(draft: Pick<ReplayDraft, 'puzzle' | 'steps' | 'summary'>): boolean {
  return (
    jsonBytes(draft.puzzle) < PUZZLE_BYTE_LIMIT &&
    jsonBytes(draft.steps) < STEPS_BYTE_LIMIT &&
    jsonBytes(draft.summary) < SUMMARY_BYTE_LIMIT
  )
}
