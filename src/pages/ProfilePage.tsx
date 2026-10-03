import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router'
import { PASSWORD_MIN } from '@/config/site'
import { ActionButton } from '@/components/comic/ActionButton'
import { HudReadout } from '@/components/comic/HudReadout'
import { Panel } from '@/components/comic/Panel'
import { PageFrame } from '@/components/PageFrame'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuth, type TeamRow } from '@/lib/auth'
import {
  AVATAR_PREPARING,
  AVATAR_SAVED,
  encodeAvatar,
} from '@/lib/avatarEncode'
import {
  avatarUrl,
  fetchSubmissions,
  fetchTeam,
  removeAvatar,
  resetTeamPassword,
  saveAvatar,
  updateTeamName,
  type SubmissionRow,
} from '@/lib/data'
import { formatScore, initials } from '@/lib/format'
import { supabase } from '@/lib/supabase'
import { rankOf, useTeamStats } from '@/lib/useTeamStats'
import { useSubmissionFeed } from '@/lib/useLive'

export function ProfilePage() {
  const { team: own, isAdmin, refreshTeam } = useAuth()
  const [searchParams] = useSearchParams()
  const requested = isAdmin ? searchParams.get('team') : null
  const targetId = requested && requested !== own?.id ? requested : null
  const [target, setTarget] = useState<TeamRow | null>(null)
  const reloadTarget = useCallback(async () => {
    setTarget(targetId ? await fetchTeam(targetId) : null)
  }, [targetId])
  useEffect(() => {
    void reloadTarget()
  }, [reloadTarget])
  const team = targetId ? target : own
  const refresh = targetId ? reloadTarget : refreshTeam
  const [name, setName] = useState(team?.team_name ?? '')
  useEffect(() => {
    if (team) setName(team.team_name)
  }, [team])
  const [password, setPassword] = useState('')
  const [nameMessage, setNameMessage] = useState('')
  const [passwordMessage, setPasswordMessage] = useState('')
  const [avatarMessage, setAvatarMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [rows, setRows] = useState<SubmissionRow[]>([])
  const stats = useTeamStats()
  const reloadRows = useCallback(() => {
    if (!team) return
    void fetchSubmissions(team.id).then(setRows).catch(() => setRows([]))
  }, [team])
  useEffect(() => {
    reloadRows()
  }, [reloadRows])
  useSubmissionFeed(targetId ? null : (team?.id ?? null), reloadRows)

  async function onName(event: FormEvent) {
    event.preventDefault()
    if (!team) return
    const next = name.trim()
    if (!next) {
      setNameMessage('Enter a team name.')
      return
    }
    setBusy(true)
    try {
      await updateTeamName(team.id, next)
      await refresh()
      setNameMessage('Team name saved.')
    } catch (error) {
      setNameMessage(error instanceof Error ? error.message : 'Could not save the name.')
    } finally {
      setBusy(false)
    }
  }

  async function onPassword(event: FormEvent) {
    event.preventDefault()
    if (!supabase) return
    if (password.length < PASSWORD_MIN) {
      setPasswordMessage(`Use at least ${PASSWORD_MIN} characters.`)
      return
    }
    setBusy(true)
    let failure: string | null = null
    if (targetId && team) {
      failure = await resetTeamPassword(team.username, password).then(
        () => null,
        (error: unknown) => (error instanceof Error ? error.message : "Couldn't update the password. Try again."),
      )
    } else {
      const { error } = await supabase.auth.updateUser({ password })
      failure = error ? error.message : null
    }
    setBusy(false)
    setPassword('')
    setPasswordMessage(failure ?? 'Password updated.')
  }

  async function onAvatar(file: File | undefined) {
    if (!file || !team) return
    setAvatarMessage(AVATAR_PREPARING)
    setBusy(true)
    try {
      const encoded = await encodeAvatar(file)
      const saved = await saveAvatar(team.id, encoded.blob)
      await refresh()
      setAvatarMessage(`${AVATAR_SAVED} ${saved.avatar_path}`)
    } catch (error) {
      setAvatarMessage(error instanceof Error ? error.message : "Couldn't upload the image. Try again.")
    } finally {
      setBusy(false)
    }
  }

  const preview = avatarUrl(team?.avatar_path, team?.updated_at)
  const mine = team ? stats.rows.find((row) => row.team_id === team.id) : undefined
  const rank = rankOf(stats.rows, team?.id ?? null)
  const submissionValue = !stats.loaded || targetId || stats.submissions == null ? '—' : String(stats.submissions)

  return (
    <PageFrame title="Profile">
      <Panel fill="maroon">
        <div className="flex flex-wrap items-center gap-5 p-5 text-ivory">
          {preview ? (
            <img src={preview} alt="" width={96} height={96} className="size-24 rounded-full border-[3px] border-ink object-cover" />
          ) : (
            <span className="grid size-24 place-items-center rounded-full border-[3px] border-ink bg-ink font-display text-3xl font-bold text-ivory">
              {initials(team?.team_name ?? 'Team')}
            </span>
          )}
          <div>
            <HudReadout>TEAM</HudReadout>
            <p className="font-display text-4xl font-bold">{team?.team_name ?? '—'}</p>
          </div>
          <dl className="grid flex-1 grid-cols-3 gap-2 sm:min-w-80">
            <div className="bg-ink px-3 py-2">
              <dt className="font-mono text-[11px] font-bold tracking-[0.14em] text-ivory-muted">BEST</dt>
              <dd className="font-display text-3xl font-bold text-ivory tabular-nums">{stats.loaded ? formatScore(mine?.best_score) : '—'}</dd>
            </div>
            <div className="bg-ink px-3 py-2">
              <dt className="font-mono text-[11px] font-bold tracking-[0.14em] text-ivory-muted">RANK</dt>
              <dd className="font-display text-3xl font-bold text-ivory tabular-nums">{stats.loaded && rank != null ? rank : '—'}</dd>
            </div>
            <div className="bg-ink px-3 py-2">
              <dt className="font-mono text-[11px] font-bold tracking-[0.14em] text-ivory-muted">SUBMISSIONS</dt>
              <dd className="font-display text-3xl font-bold text-ivory tabular-nums">{submissionValue}</dd>
            </div>
          </dl>
        </div>
      </Panel>
      <div className="grid gap-4 lg:grid-cols-3">
      <Panel fill="maroon">
      <section className="grid max-w-lg gap-3 p-4 text-ivory">
        <HudReadout>TEAM NAME</HudReadout>
        <h2 className="text-h4">Team name</h2>
        <form className="grid gap-3" onSubmit={onName}>
          <Label htmlFor="team-name">Name</Label>
          <Input id="team-name" value={name} onChange={(event) => setName(event.target.value)} className="h-11" />
          <ActionButton type="submit" disabled={busy || !team}>
            Save name
          </ActionButton>
          {nameMessage ? <p>{nameMessage.includes('saved') ? <HudReadout>SAVED</HudReadout> : null} {nameMessage}</p> : null}
        </form>
      </section>
      </Panel>
      <Panel fill="maroon">
      <section className="grid max-w-lg gap-3 p-4 text-ivory">
        <HudReadout>PASSWORD</HudReadout>
        <h2 className="text-h4">Password</h2>
        <form className="grid gap-3" onSubmit={onPassword}>
          <Label htmlFor="new-password">New password</Label>
          <Input
            id="new-password"
            type="password"
            autoComplete="new-password"
            minLength={PASSWORD_MIN}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="h-11"
          />
          <ActionButton type="submit" disabled={busy || !team}>
            Update password
          </ActionButton>
          {passwordMessage ? <p>{passwordMessage.includes('updated') ? <HudReadout>SAVED</HudReadout> : null} {passwordMessage}</p> : null}
        </form>
      </section>
      </Panel>
      <Panel fill="maroon">
      <section className="grid max-w-lg gap-3 p-4 text-ivory">
        <HudReadout>AVATAR</HudReadout>
        <h2 className="text-h4">Avatar</h2>
        {preview ? <img src={preview} alt="" width={96} height={96} className="size-24 rounded-full object-cover" /> : null}
        <Label htmlFor="avatar">PNG, JPEG, or WebP, up to 2 MB</Label>
        <Input
          id="avatar"
          type="file"
          accept="image/png,image/jpeg,image/webp"
          disabled={busy || !team}
          onChange={(event) => {
            void onAvatar(event.target.files?.[0])
            event.target.value = ''
          }}
        />
        <ActionButton
          type="button"
          variant="ghost"
          disabled={busy || !team?.avatar_path}
          onClick={() => {
            if (!team) return
            setBusy(true)
            void removeAvatar(team.id)
              .then(() => refresh())
              .then(() => setAvatarMessage('Avatar removed.'))
              .catch((error: unknown) =>
                setAvatarMessage(error instanceof Error ? error.message : "Couldn't remove the avatar. Try again."),
              )
              .finally(() => setBusy(false))
          }}
        >
          Remove avatar
        </ActionButton>
        {avatarMessage ? <p>{/updated|removed/i.test(avatarMessage) ? <HudReadout>SAVED</HudReadout> : null} {avatarMessage}</p> : null}
      </section>
      </Panel>
      </div>
      <Panel fill="ivory">
        <div className="grid gap-3 p-5 text-ink">
          <HudReadout>RECENT SUBMISSIONS</HudReadout>
          {rows.length === 0 ? (
            <p>No submissions yet.</p>
          ) : (
            <ul className="grid gap-2">
              {rows.slice(0, 8).map((row) => (
                <li key={row.id} className="flex flex-wrap items-center justify-between gap-2 border-[3px] border-ink bg-ivory px-3 py-2">
                  <span className="truncate font-mono text-sm font-bold">{row.file_name}</span>
                  <span className="font-mono text-xs font-bold tracking-[0.08em] uppercase">{row.status}</span>
                  {row.status === 'scored' ? (
                    <Link to={`/arena/${row.id}`} className="font-display text-sm font-bold text-comic-red">
                      Replay
                    </Link>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </div>
      </Panel>
    </PageFrame>
  )
}
