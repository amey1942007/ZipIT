import { useRef, useState, type FormEvent } from 'react'
import { Eye, EyeOff, TriangleAlert } from 'lucide-react'
import { useReducedMotion } from 'motion/react'
import { useNavigate, useSearchParams } from 'react-router'
import { EVENT_DATE, ORGANISER_LINE, ORGANISER_SUBLINE, TAGLINE } from '@/config/site'
import { BackendNotice } from '@/components/PageFrame'
import { ActionButton } from '@/components/comic/ActionButton'
import { Balloon } from '@/components/comic/Balloon'
import { CaptionBox } from '@/components/comic/CaptionBox'
import { HudReadout } from '@/components/comic/HudReadout'
import { Panel } from '@/components/comic/Panel'
import { PathMeter } from '@/components/comic/PathMeter'
import { usePageTitle, Wordmark } from '@/components/shell/Shell'
import { loginEmail } from '@/lib/format'
import { supabase } from '@/lib/supabase'

export function LoginPage() {
  usePageTitle('Login')
  const reduced = useReducedMotion()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)
  const [busy, setBusy] = useState(false)
  const [userError, setUserError] = useState('')
  const [passError, setPassError] = useState('')
  const [formError, setFormError] = useState('')
  const [granted, setGranted] = useState(false)
  const timer = useRef(0)

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
    const target = next && next.startsWith('/') ? next : '/'
    setGranted(true)
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => {
      navigate(target, { replace: true, state: { ziTurn: true } })
    }, reduced ? 0 : 600)
  }

  const idSet = username.trim() !== ''
  const keySet = idSet && password !== ''
  const step = busy || granted ? 3 : keySet ? 2 : idSet ? 1 : 0

  return (
    <main id="main" tabIndex={-1} className="min-h-svh bg-ink text-ivory outline-none">
      <h1 className="sr-only">Login</h1>
      <p className="sr-only">{EVENT_DATE}</p>
      <header className="zi-hud flex h-[50px] items-center justify-between border-b-2 border-[rgba(255,200,61,.55)] px-4">
        <Wordmark />
        <span className="zi-tm hidden lg:inline">
          {ORGANISER_LINE} · {ORGANISER_SUBLINE}
        </span>
        <PathMeter total={3} filled={step} label="LOGIN" readout={`PANEL ${Math.max(step, 1)}/3`} />
      </header>
      <form noValidate className="zi-login-grid" onSubmit={onSubmit}>
        <Panel fill="ivory" className="zi-login-id">
          <div className="grid h-full content-start gap-4 p-6 text-ink">
            <HudReadout>IDENTIFY · PANEL 1/3</HudReadout>
            <p className="font-display text-[clamp(40px,9cqh,64px)] leading-none font-bold -skew-x-8">
              WHO&apos;S
              <br />
              PLAYING?
            </p>
            <p className="bg-ivory px-2 py-1 text-[15px]">{TAGLINE}</p>
            <Balloon>
              <label htmlFor="username" className="font-display text-[13px] font-semibold tracking-[0.12em] text-comic-red uppercase">
                Username
              </label>
              <input
                id="username"
                name="username"
                autoComplete="username"
                autoCapitalize="none"
                spellCheck={false}
                value={username}
                aria-invalid={Boolean(userError)}
                aria-describedby={userError ? 'username-error' : undefined}
                onChange={(event) => setUsername(event.target.value)}
                readOnly={busy}
                className="mt-2 h-12 w-full border-0 border-b-[3px] border-ink bg-transparent font-mono text-2xl font-bold text-ink caret-comic-red outline-none"
              />
              {userError ? (
                <p id="username-error" className="mt-2 flex items-center gap-2 bg-comic-red px-2 py-1 text-sm font-semibold text-ivory">
                  <TriangleAlert className="size-4" /> {userError}
                </p>
              ) : null}
            </Balloon>
            <HudReadout className="justify-self-end">{idSet ? 'ID SET' : 'AWAITING ID'}</HudReadout>
          </div>
        </Panel>
        <Panel fill="maroon" className="zi-login-key">
          <div className="grid h-full content-start gap-4 p-6">
            <HudReadout>VERIFY · PANEL 2/3</HudReadout>
            <p className="font-display text-[clamp(40px,9cqh,64px)] leading-none font-bold text-ivory -skew-x-8">
              PROVE
              <br />
              <span className="text-gold">IT.</span>
            </p>
            <Balloon>
              <label htmlFor="password" className="font-display text-[13px] font-semibold tracking-[0.12em] text-comic-red uppercase">
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  name="password"
                  type={show ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  aria-invalid={Boolean(passError)}
                  aria-describedby={passError ? 'password-error' : undefined}
                  onChange={(event) => setPassword(event.target.value)}
                  readOnly={busy}
                  className="mt-2 h-12 w-full border-0 border-b-[3px] border-ink bg-transparent pr-12 font-mono text-2xl font-bold text-ink caret-comic-red outline-none"
                />
                <button
                  type="button"
                  className="absolute top-2 right-0 grid size-11 place-items-center text-ink"
                  aria-label={show ? 'Hide password' : 'Show password'}
                  aria-pressed={show}
                  onClick={() => setShow((value) => !value)}
                >
                  {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
              {passError ? (
                <p id="password-error" className="mt-2 flex items-center gap-2 bg-comic-red px-2 py-1 text-sm font-semibold text-ivory">
                  <TriangleAlert className="size-4" /> {passError}
                </p>
              ) : null}
            </Balloon>
            <HudReadout className="justify-self-end">{keySet ? 'KEY SET' : 'AWAITING KEY'}</HudReadout>
          </div>
        </Panel>
        <Panel fill="red" className="zi-login-go">
          <div className="grid h-full content-start gap-4 p-6">
            <HudReadout>ENGAGE · PANEL 3/3</HudReadout>
            <p className="comic-word text-6xl text-ivory">GO.</p>
            <BackendNotice />
            <ActionButton type="submit" size="hero" className="w-full" aria-busy={busy} disabled={busy}>
              {busy ? 'Signing in…' : 'Sign in'}
            </ActionButton>
            {formError ? (
              <div role="alert">
                <CaptionBox tone="red">
                  <p className="font-display text-[40px] font-bold text-ivory" aria-hidden>
                    DENIED
                  </p>
                  <p className="font-display text-xs font-semibold tracking-[0.12em] text-ivory uppercase">Sign in failed</p>
                  <p className="text-[15px] font-medium text-ivory">{formError}</p>
                </CaptionBox>
              </div>
            ) : null}
            <p className="font-display text-xs font-semibold text-ivory">{ORGANISER_LINE}</p>
            <HudReadout className="justify-self-end">
              {granted ? 'CLEARED' : formError ? 'DENIED' : busy ? 'CHECKING…' : 'STANDBY'}
            </HudReadout>
          </div>
        </Panel>
      </form>
      {granted ? (
        <div className="pointer-events-none fixed inset-0 grid place-items-center">
          <CaptionBox tone="red" className="-rotate-1">
            <p className="font-display text-5xl font-bold text-ivory" aria-hidden>
              ACCESS GRANTED
            </p>
            <p className="font-mono text-sm font-bold text-gold">{username.trim().toUpperCase()} · CLEARED</p>
          </CaptionBox>
          <p role="status" className="sr-only">
            Access granted. Opening ZipIT.
          </p>
        </div>
      ) : null}
    </main>
  )
}
