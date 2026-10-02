import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import type { Tables } from '@/lib/database.types'
import { isSupabaseConfigured, supabase } from '@/lib/supabase'

export type TeamRow = Tables<'teams'>

interface AuthValue {
  ready: boolean
  showSplash: boolean
  configured: boolean
  session: Session | null
  team: TeamRow | null
  isAdmin: boolean
  refreshTeam: () => Promise<void>
}

const AuthContext = createContext<AuthValue | null>(null)

async function loadTeam(session: Session | null): Promise<TeamRow | null> {
  if (!supabase || !session) return null
  const { data } = await supabase.from('teams').select('*').eq('id', session.user.id).maybeSingle()
  return data
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(!isSupabaseConfigured)
  const [showSplash, setShowSplash] = useState(false)
  const [session, setSession] = useState<Session | null>(null)
  const [team, setTeam] = useState<TeamRow | null>(null)

  const refreshTeam = async () => {
    const next = await loadTeam(session)
    setTeam(next)
  }

  useEffect(() => {
    if (!supabase) return
    const client = supabase
    let cancelled = false
    const splashTimer = window.setTimeout(() => {
      if (!cancelled) setShowSplash(true)
    }, 150)
    void client.auth.getSession().then(async ({ data }) => {
      if (cancelled) return
      setSession(data.session)
      setTeam(await loadTeam(data.session))
      if (data.session) await client.realtime.setAuth()
      window.clearTimeout(splashTimer)
      setShowSplash(false)
      setReady(true)
    })
    const { data: sub } = client.auth.onAuthStateChange((event, next) => {
      setSession(next)
      if (event === 'TOKEN_REFRESHED' || event === 'SIGNED_IN') void client.realtime.setAuth()
      if (!next) setTeam(null)
      else void loadTeam(next).then((row) => setTeam(row))
    })
    return () => {
      cancelled = true
      window.clearTimeout(splashTimer)
      sub.subscription.unsubscribe()
    }
  }, [])

  const value = useMemo<AuthValue>(
    () => ({
      ready,
      showSplash: showSplash && !ready,
      configured: isSupabaseConfigured,
      session,
      team,
      isAdmin: session?.user.app_metadata?.role === 'admin',
      refreshTeam,
    }),
    [ready, showSplash, session, team],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthValue {
  const value = useContext(AuthContext)
  if (!value) throw new Error('AuthProvider is missing')
  return value
}
