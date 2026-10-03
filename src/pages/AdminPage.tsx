import { useEffect, useMemo, useState } from 'react'
import { Link, Navigate, useParams, useSearchParams } from 'react-router'
import { ActionButton } from '@/components/comic/ActionButton'
import { ComicTabs } from '@/components/comic/ComicTabs'
import { PageFrame } from '@/components/PageFrame'
import {
  downloadSubmission,
  fetchAllSubmissions,
  fetchAudit,
  fetchLeaderboard,
  fetchSettings,
  fetchTeams,
  type AuditRow,
  type LeaderboardRow,
  type SubmissionRow,
} from '@/lib/data'
import type { Tables } from '@/lib/database.types'
import { formatIst, formatScore } from '@/lib/format'
import { compareRanking } from '@/lib/ranking'

const TABS = [
  ['teams', 'Teams'],
  ['submissions', 'Submissions'],
  ['leaderboard', 'Leaderboard'],
  ['audit', 'Audit'],
] as const

type AdminTab = (typeof TABS)[number][0]

export const ADMIN_NOTE =
  'Admins can edit team profiles (name, avatar, password). Submissions and scores are view-only.'

function isAdminTab(value: string | undefined): value is AdminTab {
  return TABS.some(([id]) => id === value)
}

export function AdminPage() {
  const params = useParams()
  const tab: AdminTab = isAdminTab(params.tab) ? params.tab : 'teams'
  const [teams, setTeams] = useState<Tables<'teams'>[]>([])
  const [submissions, setSubmissions] = useState<SubmissionRow[]>([])
  const [board, setBoard] = useState<LeaderboardRow[]>([])
  const [audit, setAudit] = useState<AuditRow[]>([])
  const [frozen, setFrozen] = useState(false)
  const [frozenAt, setFrozenAt] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [message, setMessage] = useState('')
  const [code, setCode] = useState('')
  const [searchParams] = useSearchParams()
  const teamFilter = searchParams.get('team')

  useEffect(() => {
    let cancelled = false
    void Promise.all([
      fetchTeams().catch(() => []),
      fetchAllSubmissions().catch(() => []),
      fetchLeaderboard().catch(() => []),
      fetchAudit().catch(() => []),
      fetchSettings().catch(() => null),
    ]).then(([nextTeams, nextSubs, nextBoard, nextAudit, settings]) => {
      if (cancelled) return
      setTeams(nextTeams)
      setSubmissions(nextSubs)
      setBoard(nextBoard.slice().sort(compareRanking))
      setAudit(nextAudit)
      setFrozen(Boolean(settings?.leaderboard_frozen))
      setFrozenAt(settings?.frozen_at ?? null)
    })
    return () => {
      cancelled = true
    }
  }, [])

  const visibleTeams = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle) return teams
    return teams.filter(
      (row) => row.team_name.toLowerCase().includes(needle) || row.username.toLowerCase().includes(needle),
    )
  }, [query, teams])

  const visibleSubmissions = teamFilter ? submissions.filter((row) => row.team_id === teamFilter) : submissions

  if (!isAdminTab(params.tab)) {
    return <Navigate to="/admin/teams" replace />
  }

  return (
    <PageFrame title="Admin">
      <ComicTabs
        label="Admin"
        current={`/admin/${tab}`}
        tabs={TABS.map(([id, label]) => ({ to: `/admin/${id}`, label }))}
      />
      <p>{ADMIN_NOTE}</p>
      {message ? <p className="text-text-muted">{message}</p> : null}

      {tab === 'teams' ? (
        <section className="grid gap-4">
          <label className="grid max-w-sm gap-1 text-sm text-text-muted" htmlFor="admin-team-search">
            Search
            <input
              id="admin-team-search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="h-11 rounded-xl border border-border-strong bg-surface-2 px-3 text-text"
            />
          </label>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left">
              <thead className="text-sm text-text-muted">
                <tr>
                  <th className="px-3 py-2">Team</th>
                  <th className="px-3 py-2">Username</th>
                  <th className="px-3 py-2">Role</th>
                  <th className="px-3 py-2">Replays</th>
                </tr>
              </thead>
              <tbody>
                {visibleTeams.map((row) => (
                  <tr key={row.id} className="border-t border-border">
                    <td className="px-3 py-2 font-semibold">{row.team_name}</td>
                    <td className="px-3 py-2 font-mono text-sm">@{row.username}</td>
                    <td className="px-3 py-2">{row.role}</td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap gap-3">
                        <Link to={`/admin/submissions?team=${row.id}`} className="font-semibold text-gold">
                          Open replays
                        </Link>
                        <Link to={`/profile?team=${row.id}`} className="font-semibold text-gold">
                          Edit profile
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {tab === 'submissions' ? (
        <section className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left">
            <thead className="text-sm text-text-muted">
              <tr>
                <th className="px-3 py-2">File</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Score</th>
                <th className="px-3 py-2">When</th>
                <th className="px-3 py-2">Replay</th>
              </tr>
            </thead>
            <tbody>
              {visibleSubmissions.map((row) => (
                <tr key={row.id} className="border-t border-border">
                  <td className="px-3 py-2">{row.file_name}</td>
                  <td className="px-3 py-2">{row.status}</td>
                  <td className="px-3 py-2 font-mono font-bold tabular-nums">{formatScore(row.score)}</td>
                  <td className="px-3 py-2 font-mono font-bold tabular-nums">{formatIst(row.created_at, true)}</td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-3">
                      <Link to={`/arena/${row.id}?team=${row.team_id}`} className="font-semibold text-gold">
                        Open replay
                      </Link>
                        <ActionButton
                        type="button"
                        variant="ghost"
                        onClick={() => {
                          void downloadSubmission(row.file_path)
                            .then(setCode)
                            .catch(() => setMessage('Could not load that file.'))
                        }}
                      >
                        View code
                      </ActionButton>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {code ? (
            <pre className="mt-4 max-h-80 overflow-auto rounded-xl bg-bg p-4 font-mono text-sm font-normal whitespace-pre-wrap">{code}</pre>
          ) : null}
        </section>
      ) : null}

      {tab === 'leaderboard' ? (
        <section className="grid gap-4">
          <p>{frozen ? `Frozen since ${formatIst(frozenAt, true)}` : 'Live'}</p>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left">
            <thead className="text-sm text-text-muted">
              <tr>
                <th className="px-3 py-2">Rank</th>
                <th className="px-3 py-2">Team</th>
                <th className="px-3 py-2">Score</th>
                <th className="px-3 py-2">Scored</th>
              </tr>
            </thead>
            <tbody>
              {board.length === 0 ? (
                <tr>
                  <td className="px-3 py-6 text-text-muted" colSpan={4}>
                    No scores yet.
                  </td>
                </tr>
              ) : (
                board.map((row, index) => (
                  <tr key={row.team_id} className="border-t border-border">
                    <td className="px-3 py-2 font-mono font-bold tabular-nums">{index + 1}</td>
                    <td className="px-3 py-2 font-semibold">{row.team_name}</td>
                    <td className="px-3 py-2 font-mono font-bold tabular-nums">{formatScore(row.best_score)}</td>
                    <td className="px-3 py-2 font-mono font-bold tabular-nums">{formatIst(row.best_scored_at, true)}</td>
                  </tr>
                ))
              )}
            </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {tab === 'audit' ? (
        <section className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left">
            <thead className="text-sm text-text-muted">
              <tr>
                <th className="px-3 py-2">When</th>
                <th className="px-3 py-2">Action</th>
                <th className="px-3 py-2">Actor</th>
                <th className="px-3 py-2">Details</th>
              </tr>
            </thead>
            <tbody>
              {audit.map((row) => (
                <tr key={row.id} className="border-t border-border">
                  <td className="px-3 py-2 font-mono font-bold tabular-nums">{formatIst(row.at, true)}</td>
                  <td className="px-3 py-2">{row.action}</td>
                  <td className="px-3 py-2">{row.actor_kind}</td>
                  <td className="px-3 py-2 font-mono text-xs font-normal">{JSON.stringify(row.details)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ) : null}
    </PageFrame>
  )
}
