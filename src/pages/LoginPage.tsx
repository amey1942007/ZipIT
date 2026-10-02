import { useState, type FormEvent } from 'react'
import { Eye, EyeOff, TriangleAlert } from 'lucide-react'
import { useNavigate, useSearchParams } from 'react-router'
import { EVENT_DATE, ORGANISER_LINE, ORGANISER_SUBLINE, TAGLINE } from '@/config/site'
import { BackendNotice } from '@/components/PageFrame'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { usePageTitle, Wordmark } from '@/components/shell/Shell'
import { loginEmail } from '@/lib/format'
import { supabase } from '@/lib/supabase'

export function LoginPage() {
  usePageTitle('Login')
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)
  const [busy, setBusy] = useState(false)
  const [userError, setUserError] = useState('')
  const [passError, setPassError] = useState('')
  const [formError, setFormError] = useState('')

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    const nextUser = username.trim() ? '' : 'Enter your username.'
    const nextPass = password ? '' : 'Enter your password.'
    setUserError(nextUser)
    setPassError(nextPass)
    setFormError('')
    if (nextUser || nextPass) {
      document.getElementById(nextUser ? 'username' : 'password')?.focus()
      return
    }
    if (!supabase) {
      setFormError("Can't reach the server. Check your connection and try again.")
      return
    }
    setBusy(true)
    const { error } = await supabase.auth.signInWithPassword({
      email: loginEmail(username),
      password,
    })
    setBusy(false)
    if (error) {
      const network = /fetch|network/i.test(error.message)
      setFormError(
        network
          ? "Can't reach the server. Check your connection and try again."
          : "That username and password don't match.",
      )
      if (!network) {
        setPassword('')
        document.getElementById('password')?.focus()
      }
      return
    }
    const next = params.get('next')
    navigate(next && next.startsWith('/') ? next : '/', { replace: true })
  }

  return (
    <main id="main" tabIndex={-1} className="grid min-h-svh place-items-center bg-bg px-4 outline-none">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(224,30,55,0.18),transparent_60%)]" />
      <div className="relative w-full max-w-[400px] rounded-xl border border-border bg-surface p-6 shadow-panel sm:p-8">
        <h1 className="sr-only">Login</h1>
        <p className="text-center">
          <Wordmark className="text-h2 lg:text-h1" />
        </p>
        <p className="mt-2 text-center text-text-muted">{TAGLINE}</p>
        <p className="sr-only">{EVENT_DATE}</p>
        <BackendNotice />
        <form noValidate className="mt-8 grid gap-4" onSubmit={onSubmit}>
          <div className="grid gap-2">
            <Label htmlFor="username">Username</Label>
            <Input
              id="username"
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              value={username}
              aria-invalid={Boolean(userError)}
              aria-describedby={userError ? 'username-error' : undefined}
              onChange={(event) => setUsername(event.target.value)}
              readOnly={busy}
              className="h-11 rounded-xl border-border-strong bg-surface-2 text-base"
            />
            {userError ? (
              <p id="username-error" className="flex items-center gap-2 text-danger">
                <TriangleAlert className="size-4" /> {userError}
              </p>
            ) : null}
          </div>
          <div className="grid gap-2">
            <Label htmlFor="password">Password</Label>
            <div className="relative">
              <Input
                id="password"
                type={show ? 'text' : 'password'}
                autoComplete="current-password"
                value={password}
                aria-invalid={Boolean(passError)}
                aria-describedby={passError ? 'password-error' : undefined}
                onChange={(event) => setPassword(event.target.value)}
                readOnly={busy}
                className="h-11 rounded-xl border-border-strong bg-surface-2 pr-12 text-base"
              />
              <button
                type="button"
                className="absolute top-0 right-0 grid size-11 place-items-center text-text-muted"
                aria-label={show ? 'Hide password' : 'Show password'}
                aria-pressed={show}
                onClick={() => setShow((value) => !value)}
              >
                {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
            {passError ? (
              <p id="password-error" className="flex items-center gap-2 text-danger">
                <TriangleAlert className="size-4" /> {passError}
              </p>
            ) : null}
          </div>
          {formError ? (
            <Alert variant="destructive">
              <TriangleAlert />
              <AlertTitle>Sign in failed</AlertTitle>
              <AlertDescription>{formError}</AlertDescription>
            </Alert>
          ) : null}
          <Button type="submit" className="h-11 w-full rounded-full font-semibold text-white" aria-busy={busy} disabled={busy}>
            {busy ? 'Signing in…' : 'Sign in'}
          </Button>
        </form>
        <div className="my-6 h-px bg-border" />
        <p className="text-center text-base font-semibold tracking-[0.08em] text-gold">{ORGANISER_LINE}</p>
        <p className="text-center text-xs text-text-muted">{ORGANISER_SUBLINE}</p>
      </div>
    </main>
  )
}
