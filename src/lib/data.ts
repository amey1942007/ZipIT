import { AVATAR_CHECK_ERROR } from '@/lib/avatarEncode'
import type { Tables } from '@/lib/database.types'
import { friendlyDbError } from '@/lib/format'
import { supabase } from '@/lib/supabase'

export type SubmissionRow = Tables<'submissions'>
export type LeaderboardRow = Tables<'leaderboard'>
export type SettingsRow = Tables<'app_settings'>
export type AuditRow = Tables<'admin_audit'>
export type ReplayRow = Tables<'replays'>

export function avatarUrl(path: string | null | undefined, version?: string | null): string | null {
  if (!supabase || !path) return null
  const base = supabase.storage.from('avatars').getPublicUrl(path).data.publicUrl
  if (!version) return base
  return `${base}?v=${encodeURIComponent(version)}`
}

export async function fetchLeaderboard(): Promise<LeaderboardRow[]> {
  if (!supabase) return []
  const { data, error } = await supabase.from('leaderboard').select('*')
  if (error) throw error
  return data ?? []
}

export async function fetchSettings(): Promise<SettingsRow | null> {
  if (!supabase) return null
  const { data } = await supabase.from('app_settings').select('*').eq('id', 1).maybeSingle()
  return data
}

export async function fetchSubmissions(teamId: string): Promise<SubmissionRow[]> {
  if (!supabase) return []
  const { data, error } = await supabase
    .from('submissions')
    .select('*')
    .eq('team_id', teamId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data ?? []
}

export async function fetchAllSubmissions(): Promise<SubmissionRow[]> {
  if (!supabase) return []
  const { data, error } = await supabase.from('submissions').select('*').order('created_at', { ascending: false })
  if (error) throw error
  return data ?? []
}

export async function uploadSubmission(teamId: string, file: File): Promise<SubmissionRow> {
  if (!supabase) throw new Error('backend')
  const id = crypto.randomUUID()
  const filePath = `${teamId}/${id}.py`
  const up = await supabase.storage.from('submissions').upload(filePath, file, {
    contentType: 'text/x-python',
    upsert: false,
  })
  if (up.error) throw up.error
  const inserted = await supabase
    .from('submissions')
    .insert({
      id,
      team_id: teamId,
      source: 'upload',
      file_path: filePath,
      file_name: file.name,
      size_bytes: file.size,
    })
    .select('*')
    .single()
  if (inserted.error) {
    const friendly = friendlyDbError(inserted.error)
    throw new Error(friendly ?? 'Upload failed. Check your connection and try again.')
  }
  return inserted.data
}

export async function saveAvatar(teamId: string, blob: Blob): Promise<{ avatar_path: string; updated_at: string }> {
  if (!supabase) throw new Error('backend')
  const path = `${teamId}/avatar.webp`
  const up = await supabase.storage.from('avatars').upload(path, blob, {
    contentType: 'image/webp',
    upsert: true,
  })
  if (up.error) throw new Error("Couldn't upload the image. Try again.")
  const updated = await supabase
    .from('teams')
    .update({ avatar_path: path })
    .eq('id', teamId)
    .select('avatar_path, updated_at')
    .single()
  if (updated.error) {
    if (updated.error.code === '23514') throw new Error(AVATAR_CHECK_ERROR)
    throw new Error("Couldn't upload the image. Try again.")
  }
  return { avatar_path: updated.data.avatar_path ?? path, updated_at: updated.data.updated_at }
}

export async function removeAvatar(teamId: string): Promise<void> {
  if (!supabase) return
  const path = `${teamId}/avatar.webp`
  await supabase.storage.from('avatars').remove([path])
  await supabase.from('teams').update({ avatar_path: null }).eq('id', teamId)
}

export async function updateTeamName(teamId: string, teamName: string): Promise<void> {
  if (!supabase) throw new Error('backend')
  const { error } = await supabase.from('teams').update({ team_name: teamName }).eq('id', teamId)
  if (error) {
    if (/unique|duplicate|already/i.test(error.message)) throw new Error('Another team already uses that name.')
    throw new Error(error.message)
  }
}

export async function downloadSubmission(path: string): Promise<string> {
  if (!supabase) throw new Error('backend')
  const { data, error } = await supabase.storage.from('submissions').download(path)
  if (error || !data) throw error ?? new Error('download')
  return data.text()
}

export async function fetchReplay(submissionId: string): Promise<ReplayRow | null> {
  if (!supabase) return null
  const { data } = await supabase.from('replays').select('*').eq('submission_id', submissionId).maybeSingle()
  return data
}

export async function fetchTeams(): Promise<Tables<'teams'>[]> {
  if (!supabase) return []
  const { data, error } = await supabase.from('teams').select('*').order('team_name')
  if (error) throw error
  return data ?? []
}

type CountRpc = {
  rpc: (fn: 'my_submission_count') => PromiseLike<{ data: unknown; error: { message: string } | null }>
}

/** Lifetime submission count. Call only after sign-in. Null when the RPC errors. */
export async function fetchMySubmissionCount(): Promise<number | null> {
  if (!supabase) return null
  const { data, error } = await (supabase as unknown as CountRpc).rpc('my_submission_count')
  const total = error ? null : Number(data ?? 0)
  return total == null || Number.isNaN(total) ? null : total
}

export async function fetchPendingRuns(teamId: string): Promise<number> {
  if (!supabase) return 0
  const { data, error } = await supabase.from('submissions').select('status').eq('team_id', teamId)
  if (error || !data) return 0
  return data.filter((row) => row.status === 'queued' || row.status === 'running').length
}

export async function fetchAudit(): Promise<AuditRow[]> {
  if (!supabase) return []
  const { data, error } = await supabase.from('admin_audit').select('*').order('at', { ascending: false }).limit(200)
  if (error) throw error
  return data ?? []
}
