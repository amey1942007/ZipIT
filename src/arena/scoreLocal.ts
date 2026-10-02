/** Local playback metric. This is never an official score. */
export const REPLAY_SCORE_LABEL = 'replay score'

export function replayScore(maxDepth: number, rows: number, cols: number): number {
  const cells = rows * cols
  if (cells <= 0) return 0
  return Math.round((100 * maxDepth) / cells)
}

export function replayScoreReadout(maxDepth: number, rows: number, cols: number): {
  label: typeof REPLAY_SCORE_LABEL
  value: number
  official: false
} {
  return {
    label: REPLAY_SCORE_LABEL,
    value: replayScore(maxDepth, rows, cols),
    official: false,
  }
}
