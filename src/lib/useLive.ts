import { useEffect, useRef } from 'react'
import { parseSubmissionBroadcast } from '@/lib/broadcast'
import { supabase } from '@/lib/supabase'

/** Private `team:<id>` broadcast. Refetches on subscribe and when the tab is visible again. */
export function useSubmissionFeed(teamId: string | null, reload: () => void): void {
  useEffect(() => {
    if (!supabase || !teamId) return
    const client = supabase
    let stopped = false
    const channel = client.channel(`team:${teamId}:${Math.random().toString(36).slice(2)}`, { config: { private: true } })
    void client.realtime.setAuth().then(() => {
      if (stopped) return
      channel
        .on('broadcast', { event: '*' }, ({ event, payload }) => {
          parseSubmissionBroadcast(String(event ?? ''), payload)
          reload()
        })
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') reload()
        })
    })
    const onVisible = () => {
      if (document.visibilityState === 'visible') reload()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      stopped = true
      document.removeEventListener('visibilitychange', onVisible)
      void client.removeChannel(channel)
    }
  }, [teamId, reload])
}

export function useBoardFeed(reload: () => void, onStatus?: (status: string) => void): void {
  const onStatusRef = useRef(onStatus)
  onStatusRef.current = onStatus
  useEffect(() => {
    if (!supabase) return
    const client = supabase
    let timer = 0
    const schedule = () => {
      window.clearTimeout(timer)
      timer = window.setTimeout(reload, 300)
    }
    // A page turn mounts the outgoing page and the next one together. One shared
    // channel name throws once the first instance has subscribed.
    const channel = client
      .channel(`lb:${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leaderboard' }, schedule)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'app_settings' }, schedule)
      .subscribe((status) => {
        onStatusRef.current?.(status)
      })
    return () => {
      window.clearTimeout(timer)
      void client.removeChannel(channel)
    }
  }, [reload])
}
