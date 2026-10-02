import { useCallback, useEffect, useState } from 'react'
import { PageFrame } from '@/components/PageFrame'
import { useAuth } from '@/lib/auth'
import { avatarUrl, fetchLeaderboard, fetchSettings, type LeaderboardRow } from '@/lib/data'
import { formatIst, formatScore, initials } from '@/lib/format'
import { compareRanking } from '@/lib/ranking'
import { useBoardFeed } from '@/lib/useLive'

export function LeaderboardPage() {
  const { session, team } = useAuth()
  const [rows, setRows] = useState<LeaderboardRow[]>([])
  const [frozen, setFrozen] = useState(false)
  const [frozenAt, setFrozenAt] = useState<string | null>(null)

  const reload = useCallback(() => {
    void fetchLeaderboard()
      .then((data) => setRows(data.slice().sort(compareRanking)))
      .catch(() => setRows([]))
    void fetchSettings().then((settings) => {
      setFrozen(Boolean(settings?.leaderboard_frozen))
      setFrozenAt(settings?.frozen_at ?? null)
    })
  }, [])

  useEffect(() => {
    reload()
  }, [reload])
  useBoardFeed(reload)

  const visible = session ? rows : rows.slice(0, 10)

  return (
    <PageFrame title="Leaderboard">
      {frozen ? (
        <p className="rounded-xl border border-gold bg-surface px-4 py-3 text-gold">
          The leaderboard is frozen{frozenAt ? ` as of ${formatIst(frozenAt, true)}` : ''}.
        </p>
      ) : null}
      {!session ? <p className="text-text-muted">Showing the public top 10. Sign in to see the full board.</p> : null}
      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full min-w-[640px] text-left">
          <thead className="bg-surface-2 text-sm text-text-muted">
            <tr>
              <th className="px-4 py-3 font-semibold">Rank</th>
              <th className="px-4 py-3 font-semibold">Team</th>
              <th className="px-4 py-3 font-semibold">Score</th>
              <th className="px-4 py-3 font-semibold">Scored</th>
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 ? (
              <tr>
                <td className="px-4 py-6 text-text-muted" colSpan={4}>
                  No scores yet.
                </td>
              </tr>
            ) : (
              visible.map((row, index) => {
                const mine = row.team_id === team?.id
                const photo = avatarUrl(row.avatar_path, row.best_scored_at)
                return (
                  <tr key={row.team_id} className={mine ? 'bg-surface-2' : 'bg-surface'}>
                    <td className="px-4 py-3 font-mono">{index + 1}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-2">
                        {photo ? (
                          <img src={photo} alt="" width={32} height={32} className="size-8 rounded-full object-cover" />
                        ) : (
                          <span className="grid size-8 place-items-center rounded-full bg-bg text-xs">{initials(row.team_name)}</span>
                        )}
                        {row.team_name}
                      </span>
                    </td>
                    <td className="zi-score px-4 py-3">{formatScore(row.best_score)}</td>
                    <td className="px-4 py-3 text-text-muted">{formatIst(row.best_scored_at, true)}</td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </PageFrame>
  )
}
