import { useCallback, useEffect, useRef, useState } from 'react'
import { useAuth } from '@/lib/auth'
import {
  fetchLeaderboard,
  fetchMySubmissionCount,
  fetchPendingRuns,
  fetchSettings,
  type LeaderboardRow,
  type SettingsRow,
} from '@/lib/data'
import { compareRanking } from '@/lib/ranking'
import { supabase } from '@/lib/supabase'
import { useBoardFeed, useSubmissionFeed } from '@/lib/useLive'

export interface TeamStatsSnapshot {
  rows: LeaderboardRow[]
  settings: SettingsRow | null
  /** Null when the RPC errored or the viewer is logged out. */
  submissions: number | null
  pending: number
  loaded: boolean
  offline: boolean
  boardError: boolean
  subscribed: boolean
  stale: boolean
}

export function rankOf(rows: { team_id: string }[], teamId: string | null): number | null {
  if (!teamId) return null
  const index = rows.findIndex((row) => row.team_id === teamId)
  return index >= 0 ? index + 1 : null
}

export function deltaSign(previous: number | null, next: number | null): 'up' | 'down' | 'new' | null {
  if (previous == null && next != null) return 'new'
  if (previous == null || next == null || previous === next) return null
  return next < previous ? 'up' : 'down'
}

export function shouldCelebrateBest(input: {
  first: boolean
  frozen: boolean
  introPlaying: boolean
  previousId: string | null
  nextId: string | null
  previousScore: number | null
  nextScore: number | null
}): boolean {
  if (input.first || input.frozen || input.introPlaying) return false
  if (input.nextScore == null || input.nextId == null || input.nextId === input.previousId) return false
  return input.previousScore == null || input.nextScore > input.previousScore
}

const EMPTY: TeamStatsSnapshot = {
  rows: [],
  settings: null,
  submissions: null,
  pending: 0,
  loaded: false,
  offline: false,
  boardError: false,
  subscribed: false,
  stale: false,
}

export function useTeamStats(): TeamStatsSnapshot {
  const { session, team } = useAuth()
  const signedIn = Boolean(session)
  const teamId = team?.id ?? null
  const [snap, setSnap] = useState<TeamStatsSnapshot>({ ...EMPTY, offline: !supabase })
  const flight = useRef(false)
  const dirty = useRef(false)
  const subscribed = useRef(false)
  const loadedAt = useRef(0)
  const signedRef = useRef(signedIn)
  const teamRef = useRef(teamId)
  signedRef.current = signedIn
  teamRef.current = teamId

  const reload = useCallback(() => {
    if (flight.current) {
      dirty.current = true
      return
    }
    flight.current = true
    const run = async () => {
      if (!supabase) {
        setSnap((current) => ({ ...current, loaded: true, offline: true, submissions: null, pending: 0 }))
        return
      }
      try {
        const [rows, settings, submissions, pending] = await Promise.all([
          fetchLeaderboard(),
          fetchSettings(),
          signedRef.current ? fetchMySubmissionCount() : Promise.resolve(null),
          teamRef.current ? fetchPendingRuns(teamRef.current) : Promise.resolve(0),
        ])
        loadedAt.current = Date.now()
        setSnap((current) => ({
          ...current,
          rows: rows.slice().sort(compareRanking),
          settings,
          submissions,
          pending,
          loaded: true,
          offline: false,
          boardError: false,
          stale: false,
        }))
      } catch {
        setSnap((current) => ({
          ...current,
          loaded: true,
          boardError: current.rows.length === 0,
          stale: current.rows.length > 0,
        }))
      } finally {
        flight.current = false
        if (dirty.current) {
          dirty.current = false
          reload()
        }
      }
    }
    void run()
  }, [])

  useEffect(() => {
    reload()
  }, [reload, signedIn, teamId])

  useBoardFeed(reload, (status) => {
    const next = status === 'SUBSCRIBED'
    subscribed.current = next
    setSnap((current) => ({ ...current, subscribed: next }))
  })
  useSubmissionFeed(teamId, reload)

  useEffect(() => {
    if (!supabase) return
    let interval = 0
    const arm = window.setTimeout(() => {
      if (subscribed.current) return
      interval = window.setInterval(() => {
        if (document.visibilityState === 'visible') reload()
      }, 15_000)
    }, 10_000)
    return () => {
      window.clearTimeout(arm)
      window.clearInterval(interval)
    }
  }, [reload, snap.subscribed])

  useEffect(() => {
    let lastFocus = 0
    const onVisible = () => {
      if (document.visibilityState === 'visible') reload()
    }
    const onFocus = () => {
      const now = Date.now()
      if (now - lastFocus < 5_000) return
      lastFocus = now
      reload()
    }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', onFocus)
    const staleTimer = window.setInterval(() => {
      if (subscribed.current || !loadedAt.current) return
      if (Date.now() - loadedAt.current > 45_000) setSnap((current) => ({ ...current, stale: true }))
    }, 5_000)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', onFocus)
      window.clearInterval(staleTimer)
    }
  }, [reload])

  return snap
}
