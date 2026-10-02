export interface Rankable {
  team_id: string
  best_score: number | null
  best_scored_at: string | null
}

/** `best_score DESC, best_scored_at ASC, team_id ASC`. Unscored teams sort last. */
export function compareRanking(a: Rankable, b: Rankable): number {
  const aScore = a.best_score
  const bScore = b.best_score
  if (aScore == null && bScore == null) return a.team_id.localeCompare(b.team_id)
  if (aScore == null) return 1
  if (bScore == null) return -1
  if (aScore !== bScore) return bScore - aScore
  const aTime = a.best_scored_at ?? ''
  const bTime = b.best_scored_at ?? ''
  if (aTime !== bTime) return aTime.localeCompare(bTime)
  return a.team_id.localeCompare(b.team_id)
}

export function tiedScore(row: Rankable, rows: Rankable[]): boolean {
  if (row.best_score == null) return false
  return rows.filter((item) => item.best_score === row.best_score).length > 1
}
