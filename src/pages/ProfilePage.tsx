import { useEffect, useState, type FormEvent } from 'react'
import { PASSWORD_MIN } from '@/config/site'
import { PageFrame } from '@/components/PageFrame'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuth } from '@/lib/auth'
import {
  AVATAR_PREPARING,
  AVATAR_SAVED,
  encodeAvatar,
} from '@/lib/avatarEncode'
import { avatarUrl, removeAvatar, saveAvatar, updateTeamName } from '@/lib/data'
import { supabase } from '@/lib/supabase'

export function ProfilePage() {
  const { team, refreshTeam } = useAuth()
  const [name, setName] = useState(team?.team_name ?? '')
  useEffect(() => {
    if (team) setName(team.team_name)
  }, [team])
  const [password, setPassword] = useState('')
  const [nameMessage, setNameMessage] = useState('')
  const [passwordMessage, setPasswordMessage] = useState('')
  const [avatarMessage, setAvatarMessage] = useState('')
  const [busy, setBusy] = useState(false)

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
      await refreshTeam()
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
    const { error } = await supabase.auth.updateUser({ password })
    setBusy(false)
    setPassword('')
    setPasswordMessage(error ? error.message : 'Password updated.')
  }

  async function onAvatar(file: File | undefined) {
    if (!file || !team) return
    setAvatarMessage(AVATAR_PREPARING)
    setBusy(true)
    try {
      const encoded = await encodeAvatar(file)
      const saved = await saveAvatar(team.id, encoded.blob)
      await refreshTeam()
      setAvatarMessage(`${AVATAR_SAVED} ${saved.avatar_path}`)
    } catch (error) {
      setAvatarMessage(error instanceof Error ? error.message : "Couldn't upload the image. Try again.")
    } finally {
      setBusy(false)
    }
  }

  const preview = avatarUrl(team?.avatar_path, team?.updated_at)

  return (
    <PageFrame title="Profile">
      <section className="grid max-w-lg gap-3">
        <h2 className="text-h4">Team name</h2>
        <form className="grid gap-3" onSubmit={onName}>
          <Label htmlFor="team-name">Name</Label>
          <Input id="team-name" value={name} onChange={(event) => setName(event.target.value)} className="h-11" />
          <Button type="submit" className="h-11 w-fit rounded-full text-white" disabled={busy || !team}>
            Save name
          </Button>
          {nameMessage ? <p className="text-text-muted">{nameMessage}</p> : null}
        </form>
      </section>
      <section className="grid max-w-lg gap-3">
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
          <Button type="submit" className="h-11 w-fit rounded-full text-white" disabled={busy || !team}>
            Update password
          </Button>
          {passwordMessage ? <p className="text-text-muted">{passwordMessage}</p> : null}
        </form>
      </section>
      <section className="grid max-w-lg gap-3">
        <h2 className="text-h4">Avatar</h2>
        {preview ? <img src={preview} alt="" width={96} height={96} className="size-24 rounded-full object-cover" /> : null}
        <Label htmlFor="avatar">PNG, JPEG, or WebP, up to 2 MB</Label>
        <Input
          id="avatar"
          type="file"
          accept="image/png,image/jpeg,image/webp"
          disabled={busy || !team}
          onChange={(event) => void onAvatar(event.target.files?.[0])}
        />
        <Button
          type="button"
          variant="outline"
          className="h-11 w-fit rounded-full"
          disabled={busy || !team?.avatar_path}
          onClick={() => {
            if (!team) return
            setBusy(true)
            void removeAvatar(team.id)
              .then(() => refreshTeam())
              .then(() => setAvatarMessage('Avatar removed.'))
              .catch(() => setAvatarMessage("Couldn't upload the image. Try again."))
              .finally(() => setBusy(false))
          }}
        >
          Remove avatar
        </Button>
        {avatarMessage ? <p className="text-text-muted">{avatarMessage}</p> : null}
      </section>
    </PageFrame>
  )
}
