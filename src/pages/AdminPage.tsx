import { useEffect, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router'
import { PASSWORD_MIN } from '@/config/site'
import { PageFrame } from '@/components/PageFrame'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  downloadSubmission,
  fetchAllSubmissions,
  fetchAudit,
  fetchSettings,
  fetchTeams,
  invokeTeamAction,
  setLeaderboardFrozen,
  setOfficialScore,
  type AuditRow,
  type SubmissionRow,
} from '@/lib/data'
import type { Tables } from '@/lib/database.types'
import { formatIst, formatScore } from '@/lib/format'
import { cn } from '@/lib/utils'

const TABS = [
  ['teams', 'Teams'],
  ['submissions', 'Submissions'],
  ['scores', 'Scores'],
  ['leaderboard', 'Leaderboard'],
  ['audit', 'Audit'],
] as const

export function AdminPage() {
  const params = useParams()
  const tab = TABS.some((item) => item[0] === params.tab) ? params.tab! : 'teams'
  const [teams, setTeams] = useState<Tables<'teams'>[]>([])
  const [submissions, setSubmissions] = useState<SubmissionRow[]>([])
  const [audit, setAudit] = useState<AuditRow[]>([])
  const [frozen, setFrozen] = useState(false)
  const [message, setMessage] = useState('')
  const [code, setCode] = useState('')
  const [username, setUsername] = useState('')
  const [teamName, setTeamName] = useState('')
  const [password, setPassword] = useState('')
  const [scoreId, setScoreId] = useState('')
  const [score, setScore] = useState('')
  const [reason, setReason] = useState('')

  async function reload() {
    const [nextTeams, nextSubs, nextAudit, settings] = await Promise.all([
      fetchTeams().catch(() => []),
      fetchAllSubmissions().catch(() => []),
      fetchAudit().catch(() => []),
      fetchSettings().catch(() => null),
    ])
    setTeams(nextTeams)
    setSubmissions(nextSubs)
    setAudit(nextAudit)
    setFrozen(Boolean(settings?.leaderboard_frozen))
  }

  useEffect(() => {
    void reload()
  }, [])

  async function onCreate(event: FormEvent) {
    event.preventDefault()
    if (password.length < PASSWORD_MIN) {
      setMessage(`Password must be at least ${PASSWORD_MIN} characters.`)
      return
    }
    try {
      await invokeTeamAction({ action: 'create', username: username.trim().toLowerCase(), team_name: teamName.trim(), password })
      setUsername('')
      setTeamName('')
      setPassword('')
      setMessage('Team created.')
      await reload()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not create the team.')
    }
  }

  return (
    <PageFrame title="Admin">
      <nav className="flex flex-wrap gap-2" aria-label="Admin">
        {TABS.map(([id, label]) => (
          <Link
            key={id}
            to={`/admin/${id}`}
            className={cn(
              'inline-flex h-11 items-center rounded-full border px-4 font-semibold',
              tab === id ? 'border-gold bg-gold text-on-gold' : 'border-border text-text',
            )}
          >
            {label}
          </Link>
        ))}
      </nav>
      {message ? <p className="text-text-muted">{message}</p> : null}

      {tab === 'teams' ? (
        <section className="grid gap-4">
          <form className="grid max-w-lg gap-3 rounded-xl border border-border bg-surface p-4" onSubmit={onCreate}>
            <h2 className="text-h4">Create team</h2>
            <Label htmlFor="new-username">Username</Label>
            <Input id="new-username" value={username} onChange={(event) => setUsername(event.target.value)} required />
            <Label htmlFor="new-team">Team name</Label>
            <Input id="new-team" value={teamName} onChange={(event) => setTeamName(event.target.value)} required />
            <Label htmlFor="new-pass">Password</Label>
            <Input id="new-pass" type="password" minLength={PASSWORD_MIN} value={password} onChange={(event) => setPassword(event.target.value)} required />
            <Button type="submit" className="h-11 w-fit rounded-full text-white">
              Create
            </Button>
          </form>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left">
              <thead className="text-sm text-text-muted">
                <tr>
                  <th className="px-3 py-2">Team</th>
                  <th className="px-3 py-2">Username</th>
                  <th className="px-3 py-2">Role</th>
                  <th className="px-3 py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {teams.map((row) => (
                  <tr key={row.id} className="border-t border-border">
                    <td className="px-3 py-2">{row.team_name}</td>
                    <td className="px-3 py-2 font-mono text-sm">@{row.username}</td>
                    <td className="px-3 py-2">{row.role}</td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          className="h-11 rounded-full"
                          onClick={() => {
                            const next = window.prompt('New password (at least 8 characters)')
                            if (!next || next.length < PASSWORD_MIN) return
                            void invokeTeamAction({ action: 'reset_password', team_id: row.id, password: next })
                              .then(() => setMessage(`Password reset for ${row.team_name}.`))
                              .catch((error: unknown) => setMessage(error instanceof Error ? error.message : 'Reset failed.'))
                          }}
                        >
                          Reset password
                        </Button>
                        <Button
                          type="button"
                          variant="destructive"
                          className="h-11 rounded-full"
                          onClick={() => {
                            if (!window.confirm(`Delete ${row.team_name}?`)) return
                            void invokeTeamAction({ action: 'delete', team_id: row.id })
                              .then(() => reload())
                              .then(() => setMessage(`${row.team_name} deleted.`))
                              .catch((error: unknown) => setMessage(error instanceof Error ? error.message : 'Delete failed.'))
                          }}
                        >
                          Delete
                        </Button>
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
                <th className="px-3 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {submissions.map((row) => (
                <tr key={row.id} className="border-t border-border">
                  <td className="px-3 py-2">{row.file_name}</td>
                  <td className="px-3 py-2">{row.status}</td>
                  <td className="px-3 py-2">{formatScore(row.score)}</td>
                  <td className="px-3 py-2 font-mono font-bold tabular-nums">{formatIst(row.created_at, true)}</td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        className="h-11 rounded-full"
                        onClick={() => {
                          void downloadSubmission(row.file_path)
                            .then(setCode)
                            .catch(() => setMessage('Could not download that file.'))
                        }}
                      >
                        Download
                      </Button>
                      <Button asChild variant="outline" className="h-11 rounded-full">
                        <Link to={`/arena/${row.id}?team=${row.team_id}`}>View</Link>
                      </Button>
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

      {tab === 'scores' ? (
        <form
          className="grid max-w-lg gap-3"
          onSubmit={(event) => {
            event.preventDefault()
            const value = Number(score)
            if (!scoreId || !Number.isFinite(value)) {
              setMessage('Choose a submission and a score.')
              return
            }
            if (!reason.trim()) {
              setMessage('A reason is required.')
              return
            }
            void setOfficialScore(scoreId, value, reason.trim())
              .then(() => {
                setMessage('Score saved.')
                setReason('')
                return reload()
              })
              .catch((error: unknown) => setMessage(error instanceof Error ? error.message : 'Could not save the score.'))
          }}
        >
          <h2 className="text-h4">Set official score</h2>
          <Label htmlFor="score-submission">Submission</Label>
          <select
            id="score-submission"
            className="h-11 rounded-xl border border-border-strong bg-surface-2 px-3"
            value={scoreId}
            onChange={(event) => setScoreId(event.target.value)}
          >
            <option value="">Choose</option>
            {submissions.map((row) => (
              <option key={row.id} value={row.id}>
                {row.file_name} · {row.status}
              </option>
            ))}
          </select>
          <Label htmlFor="official-score">Score</Label>
          <Input id="official-score" inputMode="decimal" value={score} onChange={(event) => setScore(event.target.value)} />
          <Label htmlFor="score-reason">Reason</Label>
          <textarea
            id="score-reason"
            className="min-h-24 rounded-xl border border-border-strong bg-surface-2 p-3"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
          />
          <Button type="submit" className="h-11 w-fit rounded-full text-white">
            Save score
          </Button>
        </form>
      ) : null}

      {tab === 'leaderboard' ? (
        <section className="grid max-w-lg gap-3">
          <h2 className="text-h4">Freeze</h2>
          <p className="text-text-muted">{frozen ? 'The leaderboard is frozen.' : 'The leaderboard is live.'}</p>
          <Button
            type="button"
            className="h-11 w-fit rounded-full text-white"
            onClick={() => {
              void setLeaderboardFrozen(!frozen)
                .then(() => reload())
                .then(() => setMessage(frozen ? 'Leaderboard unfrozen.' : 'Leaderboard frozen.'))
                .catch((error: unknown) => setMessage(error instanceof Error ? error.message : 'Could not update the freeze.'))
            }}
          >
            {frozen ? 'Unfreeze' : 'Freeze leaderboard'}
          </Button>
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
                  <td className="px-3 py-2 font-mono text-xs">{JSON.stringify(row.details)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ) : null}
    </PageFrame>
  )
}
