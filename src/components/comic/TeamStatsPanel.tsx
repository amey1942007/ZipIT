import { useEffect, useRef, useState } from 'react'
import { Lock } from 'lucide-react'
import { Link } from 'react-router'
import { PUBLIC_BOARD_TOP_N } from '@/config/site'
import { ActionButton } from '@/components/comic/ActionButton'
import { Sfx } from '@/components/comic/Sfx'
import { useAuth } from '@/lib/auth'
import { avatarUrl } from '@/lib/data'
import { formatIst, formatScore, initials } from '@/lib/format'
import { deltaSign, rankOf, shouldCelebrateBest, useTeamStats } from '@/lib/useTeamStats'

function LiveDot({ live, frozen }: { live: boolean; frozen: boolean }) {
  if (frozen) {
    return (
      <span className="inline-flex items-center gap-1 font-mono text-[10px] font-bold tracking-[0.14em] text-gold">
        <Lock className="size-3" aria-hidden /> FROZEN
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 font-mono text-[10px] font-bold tracking-[0.14em] text-gold">
      <i aria-hidden className={`inline-block size-2.5 rounded-full border-2 border-ink ${live ? 'bg-gold' : 'bg-transparent'}`} />
      LIVE
    </span>
  )
}

function Stat({
  label,
  value,
  sub,
  loading,
}: {
  label: string
  value: string
  sub: string
  loading?: boolean
}) {
  return (
    <div className="cut-sm grid gap-1 border-2 border-[rgba(255,200,61,.35)] bg-ink px-3.5 py-2.5">
      <dt className="font-mono text-[11px] font-bold tracking-[0.14em] text-gold uppercase">{label}</dt>
      <dd className="font-display text-[28px] leading-none font-bold text-ivory tabular-nums lg:text-[40px]">
        {loading ? <span className="zi-skeleton inline-block h-10 w-24" /> : value}
        <span className="sr-only">
          {label} {value}. {sub}
        </span>
      </dd>
      <p className="font-mono text-[11px] text-ivory-muted">{sub}</p>
    </div>
  )
}

export function TeamStatsPanel({ introDone = true }: { introDone?: boolean }) {
  const { session, team, isAdmin } = useAuth()
  const stats = useTeamStats()
  const mine = team ? stats.rows.find((row) => row.team_id === team.id) : undefined
  const rank = rankOf(stats.rows, team?.id ?? null)
  const frozen = Boolean(stats.settings?.leaderboard_frozen)
  const [delta, setDelta] = useState<{ sign: 'up' | 'down' | 'new'; n: number } | null>(null)
  const [burst, setBurst] = useState(false)
  const baseline = useRef(true)
  const prevRank = useRef<number | null>(null)
  const prevScore = useRef<number | null>(null)
  const prevId = useRef<string | null>(null)

  useEffect(() => {
    if (!stats.loaded || !session || isAdmin) return
    const nextRank = rank
    const nextScore = mine?.best_score ?? null
    const nextId = mine?.best_submission_id ?? null
    if (baseline.current) {
      baseline.current = false
      prevRank.current = nextRank
      prevScore.current = nextScore
      prevId.current = nextId
      return
    }
    const sign = frozen ? null : deltaSign(prevRank.current, nextRank)
    if (sign) setDelta({ sign, n: sign === 'new' ? nextRank ?? 0 : Math.abs((prevRank.current ?? 0) - (nextRank ?? 0)) })
    if (
      shouldCelebrateBest({
        first: false,
        frozen,
        introPlaying: !introDone,
        previousId: prevId.current,
        nextId,
        previousScore: prevScore.current,
        nextScore,
      })
    ) {
      setBurst(true)
    }
    prevRank.current = nextRank
    prevScore.current = nextScore
    prevId.current = nextId
  }, [stats.loaded, stats.rows, session, isAdmin, rank, mine, frozen, introDone])

  useEffect(() => {
    if (!delta) return
    const timer = window.setTimeout(() => setDelta(null), 4000)
    return () => window.clearTimeout(timer)
  }, [delta])

  useEffect(() => {
    if (!burst) return
    const timer = window.setTimeout(() => setBurst(false), 1400)
    return () => window.clearTimeout(timer)
  }, [burst])

  if (!session) {
    const showTop = PUBLIC_BOARD_TOP_N >= 3 && stats.rows.length > 0
    return (
      <section aria-labelledby="zi-stats-h" className="relative grid h-full content-start gap-2 p-3.5 sm:p-4">
        <h2 id="zi-stats-h" className="sr-only">
          {showTop ? 'Top 3' : 'Team stats'}
        </h2>
        <div className="flex items-center justify-between">
          <span className="zi-tm">{showTop ? 'TOP 3 · LIVE' : 'TEAM STATS · LOCKED'}</span>
          {showTop ? <LiveDot live={stats.subscribed} frozen={frozen} /> : null}
        </div>
        {showTop ? (
          <ol className="grid gap-1.5">
            {stats.rows.slice(0, 3).map((row, index) => (
              <li key={row.team_id} className="flex h-11 items-center gap-2 bg-ink px-2 text-ivory">
                <span className="grid size-7 place-items-center font-mono text-sm font-bold text-gold">{index + 1}</span>
                <span className="min-w-0 flex-1 truncate text-[15px] font-semibold">{row.team_name}</span>
                <span className="font-mono text-[15px] font-bold text-gold tabular-nums">{formatScore(row.best_score)}</span>
              </li>
            ))}
          </ol>
        ) : (
          <div>
            <p className="font-display text-2xl font-bold text-ivory">Your stats live here.</p>
            <p className="mt-1 text-[15px] text-ivory-muted">Sign in to see your best score, runs on file and rank.</p>
          </div>
        )}
        {stats.loaded && stats.rows.length === 0 ? <p className="text-ivory-muted">No scores yet.</p> : null}
        <ActionButton to="/login?next=%2F" className="mt-1">
          Sign in to see your stats
        </ActionButton>
        {showTop ? (
          <Link to="/leaderboard" className="font-mono text-[11px] font-bold tracking-[0.14em] text-gold">
            Full board →
          </Link>
        ) : null}
      </section>
    )
  }

  if (isAdmin && !team) {
    return (
      <section aria-labelledby="zi-stats-h" className="grid h-full content-start gap-2 p-3.5 sm:p-4">
        <h2 id="zi-stats-h" className="sr-only">
          Top 3
        </h2>
        <div className="flex items-center justify-between">
          <span className="zi-tm">TOP 3 · LIVE</span>
          <LiveDot live={stats.subscribed && !stats.stale} frozen={frozen} />
        </div>
        <ol className="grid gap-1.5">
          {stats.rows.slice(0, 3).map((row, index) => (
            <li key={row.team_id} className="flex h-11 items-center gap-2 bg-ink px-2 text-ivory">
              <span className="font-mono font-bold text-gold">{index + 1}</span>
              <span className="min-w-0 flex-1 truncate">{row.team_name}</span>
              <span className="font-mono font-bold text-gold">{formatScore(row.best_score)}</span>
            </li>
          ))}
        </ol>
        {stats.rows.length === 0 ? <p className="text-ivory-muted">No scores yet.</p> : null}
        <Link to="/admin/leaderboard" className="font-mono text-[11px] font-bold tracking-[0.14em] text-gold">
          Full board →
        </Link>
      </section>
    )
  }

  const caption = stats.offline
    ? 'TEAM STATS · OFFLINE'
    : !stats.loaded
      ? 'TEAM STATS · SYNC'
      : frozen
        ? 'TEAM STATS · FROZEN'
        : stats.stale
          ? 'TEAM STATS · STALE'
          : 'TEAM STATS · LIVE'
  const empty = stats.loaded && !mine && stats.submissions === 0 && stats.pending === 0
  const photo = avatarUrl(team?.avatar_path, team?.updated_at)
  const bestSub = frozen
    ? 'BOARD BEST · FROZEN'
    : mine?.best_scored_at
      ? `SET ${formatIst(mine.best_scored_at)}`
      : stats.pending > 0
        ? 'SCORING…'
        : 'NO SCORE YET'
  const submissionValue = !stats.loaded ? '' : stats.submissions == null ? '—' : String(stats.submissions)
  const submissionSub = stats.pending > 0 ? `+${stats.pending} IN QUEUE` : 'TOTAL SINCE 3 OCT'

  return (
    <section aria-labelledby="zi-stats-h" className="relative grid h-full content-start gap-2 p-3.5 sm:p-4">
      <h2 id="zi-stats-h" className="sr-only">
        Team stats
      </h2>
      <div className="flex items-center justify-between gap-2">
        <span className="zi-tm" aria-hidden>
          {caption}
        </span>
        <LiveDot live={stats.subscribed && !stats.stale && !stats.offline} frozen={frozen} />
      </div>
      <div className="flex items-center gap-2">
        {photo ? (
          <img src={photo} alt="" width={32} height={32} className="size-8 rounded-full object-cover" />
        ) : (
          <span className="grid size-8 place-items-center rounded-full bg-ink font-mono text-xs text-ivory">
            {initials(team?.team_name ?? '?')}
          </span>
        )}
        <p className="truncate font-display text-lg font-bold text-ivory lg:text-[22px]">{team?.team_name ?? '—'}</p>
      </div>
      {frozen && stats.settings?.frozen_at ? (
        <p className="font-mono text-[11px] text-ivory-muted">Standings frozen as of {formatIst(stats.settings.frozen_at, true)}</p>
      ) : null}
      {stats.boardError ? <p className="bg-comic-red px-2 py-1 text-xs font-semibold text-ivory">Stats unavailable. Retrying.</p> : null}
      <dl className="grid gap-2">
        <Stat label="BEST SCORE" value={mine ? formatScore(mine.best_score) : '—'} sub={bestSub} loading={!stats.loaded} />
        <Stat
          label="RANK"
          value={rank == null ? '—' : `#${rank}`}
          sub={rank == null ? 'NOT RANKED YET' : `OF ${stats.rows.length} RANKED`}
          loading={!stats.loaded}
        />
        <Stat label="SUBMISSIONS" value={submissionValue || '—'} sub={submissionSub} loading={!stats.loaded} />
      </dl>
      {delta ? (
        <p className="cut-sm w-fit bg-gold px-1.5 font-mono text-xs font-bold text-ink shadow-[2px_2px_0_#1C0509]">
          {delta.sign === 'new' ? 'NEW' : delta.sign === 'up' ? `▲${delta.n}` : `▼${delta.n}`}
        </p>
      ) : null}
      {burst ? <Sfx preset="newbest" stamp /> : null}
      <Link
        to="/submissions"
        className="cut-sm absolute right-4 bottom-4 bg-ink px-2 py-1 font-mono text-[11px] font-bold tracking-[0.14em] text-gold after:absolute after:inset-0"
      >
        {empty ? 'Submit your first heuristic →' : 'VIEW YOUR RUNS →'}
      </Link>
    </section>
  )
}
