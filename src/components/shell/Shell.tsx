import { useEffect, useState, type ReactNode } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router'
import {
  ChartColumn,
  ExternalLink,
  FileCheck,
  Grid3x3,
  House,
  LogOut,
  Shield,
  User,
} from 'lucide-react'
import { CODE_PLAYGROUND_URL, ORGANISER_LINE, ORGANISER_SUBLINE } from '@/config/site'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useAuth } from '@/lib/auth'
import { avatarUrl } from '@/lib/data'
import { initials } from '@/lib/format'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'

const links = [
  { to: '/', label: 'Home', icon: House, end: true },
  { to: '/submissions', label: 'Submissions', icon: FileCheck, end: false },
  { to: '/arena', label: 'Arena', icon: Grid3x3, end: false },
  { to: '/leaderboard', label: 'Leaderboard', icon: ChartColumn, end: false },
]

export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn('font-display text-h4 font-bold tracking-[0.01em]', className)}>
      <span className="text-text">Zip</span>
      <span className="text-gold">IT</span>
    </span>
  )
}

export function usePageTitle(page: string) {
  useEffect(() => {
    document.title = `${page} · ZipIT`
  }, [page])
}

export function CodePlaygroundButton({
  compact = false,
  hero = false,
  className,
}: {
  compact?: boolean
  hero?: boolean
  className?: string
}) {
  const label = compact ? 'Playground' : 'Code Playground'
  const classes = cn('zi-abtn zi-abtn-primary relative', hero ? 'zi-abtn-hero' : 'zi-abtn', className)
  const href = CODE_PLAYGROUND_URL || 'about:blank'
  const pop = (event: { currentTarget: HTMLElement }) => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const el = event.currentTarget
    el.classList.remove('zi-squash')
    void el.offsetWidth
    el.classList.add('zi-squash')
  }
  return (
    <a className={classes} href={href} target="_blank" rel="noopener noreferrer" onClick={pop}>
      {label}
      <ExternalLink aria-hidden className="size-4" />
      <span className="sr-only">(opens in a new tab)</span>
    </a>
  )
}

function TeamMark({ size, name }: { size: number; name: string }) {
  const { team } = useAuth()
  const url = avatarUrl(team?.avatar_path, team?.updated_at)
  if (url) {
    return <img src={url} alt={`${name} avatar`} width={size} height={size} className="rounded-full object-cover" />
  }
  return (
    <span
      className="grid place-items-center rounded-full border border-border-strong bg-surface-2 font-semibold text-text"
      style={{ width: size, height: size }}
    >
      {initials(name)}
    </span>
  )
}

export function AppShell({ children, bare = false }: { children: ReactNode; bare?: boolean }) {
  const { session, team, isAdmin } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [narrow, setNarrow] = useState(() => window.matchMedia('(max-width: 359px)').matches)
  const [mobile, setMobile] = useState(() => window.matchMedia('(max-width: 639px)').matches)
  const [tablet, setTablet] = useState(() => window.matchMedia('(max-width: 1023px)').matches)
  const loggedOut = !session
  const leaderboardOnly = loggedOut && location.pathname === '/leaderboard'
  const arenaMobile = location.pathname.startsWith('/arena')
  const name = team?.team_name ?? 'Team'
  const desktopNav = isAdmin ? [...links, { to: '/admin/teams', label: 'Admin', icon: Shield, end: false }] : links
  const mobileNav = isAdmin
    ? links.map((link) => (link.to === '/submissions' ? { ...link, to: '/admin/teams', label: 'Admin', icon: Shield } : link))
    : links

  useEffect(() => {
    const tiny = window.matchMedia('(max-width: 359px)')
    const phone = window.matchMedia('(max-width: 639px)')
    const tab = window.matchMedia('(max-width: 1023px)')
    const onChange = () => {
      setNarrow(tiny.matches)
      setMobile(phone.matches)
      setTablet(tab.matches)
    }
    tiny.addEventListener('change', onChange)
    phone.addEventListener('change', onChange)
    tab.addEventListener('change', onChange)
    return () => {
      tiny.removeEventListener('change', onChange)
      phone.removeEventListener('change', onChange)
      tab.removeEventListener('change', onChange)
    }
  }, [])

  if (bare) return <>{children}</>

  return (
    <div className="min-h-svh bg-bg text-text">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-full focus:bg-gold focus:px-4 focus:py-2 focus:text-on-gold"
      >
        Skip to main content
      </a>
      <header role="banner" className="zi-hud sticky top-0 z-40 h-14 border-b-2 border-[rgba(255,200,61,.55)] bg-ink lg:h-16">
        <div className="mx-auto flex h-full max-w-[1280px] items-center gap-2 px-4 sm:gap-4 sm:px-6">
          <NavLink to="/" aria-label="ZipIT home" className="inline-flex min-h-11 items-center">
            <Wordmark />
          </NavLink>
          {!loggedOut && !mobile ? (
            <nav aria-label="Primary" className="flex flex-1 items-center justify-center gap-2">
              {desktopNav.map((link) => (
                <NavLink
                  key={link.to}
                  to={link.to}
                  end={link.end}
                  title={link.label}
                  className={({ isActive }) =>
                    cn('zi-tab relative', isActive ? 'zi-tab-active' : 'zi-tab-idle')
                  }
                >
                  {() => (
                    <>
                      {tablet ? <link.icon aria-hidden className="size-5" /> : <span>{link.label}</span>}
                      {tablet ? <span className="sr-only">{link.label}</span> : null}
                      {isAdmin && link.label === 'Admin' ? (
                        <span className="ml-1 rounded-full bg-primary px-2 text-xs font-semibold text-white">ADMIN</span>
                      ) : null}
                    </>
                  )}
                </NavLink>
              ))}
            </nav>
          ) : (
            <span className="flex-1" />
          )}
          <div className="ml-auto flex items-center gap-2">
            {leaderboardOnly ? (
              <button type="button" className="zi-abtn zi-abtn-primary" onClick={() => navigate('/login')}>
                Sign in
              </button>
            ) : null}
            {session ? (
              <>
                <CodePlaygroundButton compact={narrow} className="max-[359px]:px-3 max-[359px]:text-sm" />
                <DropdownMenu>
                  <DropdownMenuTrigger className="inline-flex size-11 items-center justify-center rounded-full">
                    <TeamMark size={narrow ? 36 : 40} name={name} />
                    <span className="sr-only">Account menu</span>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56 rounded-sm border-[3px] border-ink bg-ivory text-ink shadow-hard ring-0">
                    <DropdownMenuLabel>
                      <span className="flex items-center gap-2">
                        <TeamMark size={40} name={name} />
                        <span className="min-w-0">
                          <span className="block truncate font-semibold">{name}</span>
                          <span className="block truncate font-mono text-xs text-text-muted">@{team?.username}</span>
                        </span>
                        {isAdmin ? (
                          <span className="rounded-full bg-primary px-2 py-0.5 text-xs font-semibold text-white">ADMIN</span>
                        ) : null}
                      </span>
                    </DropdownMenuLabel>
                    <DropdownMenuItem onClick={() => navigate('/profile')}>
                      <User /> Profile
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <a href={CODE_PLAYGROUND_URL || 'about:blank'} target="_blank" rel="noopener noreferrer">
                        <ExternalLink /> Code Playground
                        <span className="sr-only">(opens in a new tab)</span>
                      </a>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      variant="destructive"
                      onClick={() => {
                        void supabase?.auth.signOut()
                        navigate('/login', { state: { ziTurn: true } })
                      }}
                    >
                      <LogOut /> Sign out
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            ) : null}
          </div>
        </div>
      </header>
      <div className={cn('pb-24 sm:pb-0', arenaMobile && 'max-sm:pb-28')}>{children}</div>
      {session && !(arenaMobile && mobile) ? (
        <footer className="relative border-t-2 border-[rgba(255,200,61,.55)] bg-ink px-4 py-8 text-center">
          <div className="ht-deep absolute inset-x-0 top-0 h-1.5" aria-hidden />
          <p className="font-display text-xs font-semibold tracking-[0.12em] text-gold">{ORGANISER_LINE}</p>
          <p className="text-[13px] text-ivory-muted">{ORGANISER_SUBLINE}</p>
        </footer>
      ) : null}
      {session && mobile ? (
        <nav
          aria-label="Primary"
          className="fixed inset-x-0 bottom-0 z-40 grid h-[calc(64px+env(safe-area-inset-bottom))] grid-cols-4 border-t-2 border-[rgba(255,200,61,.55)] bg-ink pb-[env(safe-area-inset-bottom)]"
        >
          {mobileNav.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.end}
              className={({ isActive }) =>
                cn(
                  'relative flex min-h-11 flex-col items-center justify-center gap-1 text-xs font-semibold text-ivory-muted',
                  isActive && 'text-gold',
                )
              }
            >
              {({ isActive }) => (
                <>
                  {isActive ? <span className="absolute inset-x-0 top-0 h-[3px] bg-gold" /> : null}
                  <link.icon aria-hidden className="size-6" />
                  {link.label}
                </>
              )}
            </NavLink>
          ))}
        </nav>
      ) : null}
    </div>
  )
}
