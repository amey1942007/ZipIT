import { useCallback, useEffect, useState } from 'react'
import { PUBLIC_BOARD_TOP_N } from '@/config/site'
import { CaptionBox } from '@/components/comic/CaptionBox'
import { HudReadout } from '@/components/comic/HudReadout'
import { PageFrame } from '@/components/PageFrame'
import { Link } from 'react-router'
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

  const visible = session ? rows : rows.slice(0, PUBLIC_BOARD_TOP_N)

  return (
    <PageFrame title="Leaderboard">
      {frozen ? (
        <HudReadout>The leaderboard is frozen{frozenAt ? ` as of ${formatIst(frozenAt, true)}` : ''}.</HudReadout>
      ) : null}
      {!session ? (
        <CaptionBox compact>
          <p>
            Showing the public top 10. <Link to="/login">Sign in</Link> to see the full board.
          </p>
        </CaptionBox>
      ) : null}
      <div role="table" className="grid gap-2 overflow-x-auto">
        <div role="row" className="grid grid-cols-[72px_1fr_140px_160px] bg-ink px-3 py-2 font-display text-xs font-semibold tracking-[0.1em] text-ivory-muted uppercase">
          <span role="columnheader">Rank</span>
          <span role="columnheader">Team</span>
          <span role="columnheader">Score</span>
          <span role="columnheader">Scored</span>
        </div>
        {visible.length === 0 ? (
          <p className="px-3 py-6 text-ivory-muted">No scores yet.</p>
        ) : (
          visible.map((row, index) => {
            const mine = row.team_id === team?.id
            const photo = avatarUrl(row.avatar_path, row.best_scored_at)
            const top = index < 3
            const inkNums = mine || index === 0 || index === 1
            return (
              <div
                key={row.team_id}
                role="row"
                className={`grid h-16 grid-cols-[72px_1fr_140px_160px] items-center border-[3px] border-ink px-3 ${
                  mine ? 'ht-ivory text-ink' : top && index === 0 ? 'ht-gold text-ink' : top && index === 1 ? 'ht-ivory-red text-ink' : top && index === 2 ? 'ht-red text-ivory' : 'ht-maroon text-ivory'
                } ${top ? 'shadow-[inset_4px_0_0_#FFC83D]' : ''}`}
              >
                <span role="cell" className={`font-mono text-base font-bold tabular-nums ${inkNums ? 'text-ink' : 'text-ivory'}`}>
                  {index + 1}
                </span>
                <span role="cell" className="inline-flex items-center gap-2 font-semibold">
                  {photo ? (
                    <img src={photo} alt="" width={32} height={32} className="size-8 rounded-full object-cover" />
                  ) : (
                    <span className="grid size-8 place-items-center rounded-full bg-ink text-xs text-ivory">{initials(row.team_name)}</span>
                  )}
                  {row.team_name}
                  {mine ? <span className="bg-comic-red px-1 font-mono text-[11px] font-bold text-ivory">YOU</span> : null}
                </span>
                <span role="cell" className={`text-right font-mono text-[21px] font-bold tabular-nums ${inkNums ? 'text-ink' : 'text-ivory'}`}>
                  {formatScore(row.best_score)}
                </span>
                <span role="cell" className="text-right font-mono font-bold tabular-nums">
                  {formatIst(row.best_scored_at, true)}
                </span>
              </div>
            )
          })
        )}
      </div>
    </PageFrame>
  )
}
