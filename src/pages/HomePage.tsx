import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { EVENT_DATE, ORGANISER_LINE, ORGANISER_SUBLINE, TAGLINE } from '@/config/site'
import { PageFrame } from '@/components/PageFrame'
import { CodePlaygroundButton } from '@/components/shell/Shell'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/lib/auth'
import { fetchLeaderboard } from '@/lib/data'
import { compareRanking } from '@/lib/ranking'

export function HomePage() {
  const { session, team } = useAuth()
  const [rank, setRank] = useState<string>('—')
  const [teams, setTeams] = useState(0)

  useEffect(() => {
    let stop = false
    void fetchLeaderboard()
      .then((rows) => {
        if (stop) return
        const sorted = rows.slice().sort(compareRanking)
        setTeams(sorted.length)
        const place = team ? sorted.findIndex((row) => row.team_id === team.id) : -1
        setRank(place >= 0 ? String(place + 1) : '—')
      })
      .catch(() => {
        if (!stop) setRank('—')
      })
    return () => {
      stop = true
    }
  }, [team])

  return (
    <PageFrame title="Home">
      <section className="grid gap-6 rounded-xl border border-border bg-surface p-6 shadow-panel lg:grid-cols-[1.4fr_1fr] lg:p-10">
        <div>
          <p className="font-display text-h2 text-text lg:text-h1">
            Zip<span className="text-gold">IT</span>
          </p>
          <p className="mt-3 max-w-xl text-text-muted">{TAGLINE}</p>
          <p className="mt-2 text-sm text-gold">{EVENT_DATE}</p>
          <div className="mt-6 flex flex-wrap gap-3">
            {session ? (
              <Button asChild className="h-11 rounded-full px-6 text-white">
                <Link to="/submissions">Upload a heuristic</Link>
              </Button>
            ) : (
              <Button asChild className="h-11 rounded-full px-6 text-white">
                <Link to="/login">Sign in</Link>
              </Button>
            )}
            <Button asChild variant="outline" className="h-11 rounded-full px-6">
              <Link to="/leaderboard">Leaderboard</Link>
            </Button>
            <Button asChild variant="outline" className="h-11 rounded-full px-6">
              <Link to="/arena">Arena</Link>
            </Button>
            <CodePlaygroundButton />
          </div>
        </div>
        <dl className="grid content-start gap-3 rounded-xl border border-[var(--zi-hairline-gold)] bg-bg p-4 font-mono">
          <div className="flex justify-between gap-4">
            <dt className="text-text-muted">STATUS</dt>
            <dd className="text-success">NOMINAL</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-text-muted">TEAM</dt>
            <dd>{team?.team_name ?? '—'}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-text-muted">RANK</dt>
            <dd>
              {rank}
              {teams ? ` / ${teams}` : ''}
            </dd>
          </div>
        </dl>
      </section>
      <p className="text-center text-xs tracking-[0.12em] text-text-muted">
        {ORGANISER_LINE}
        <span className="mt-1 block normal-case tracking-normal">{ORGANISER_SUBLINE}</span>
      </p>
    </PageFrame>
  )
}
