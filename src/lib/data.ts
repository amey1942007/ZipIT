import { AVATAR_CHECK_ERROR } from '@/lib/avatarEncode'
import type { Tables } from '@/lib/database.types'
import { QUEUE_CAP } from '@/config/site'
import { friendlyDbError, friendlyStorageError, QUEUE_FULL_MESSAGE } from '@/lib/format'
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

export interface SubmissionFiles {
  search: File
  tiebreaker: File
}

const UPLOAD_FAILED = 'Upload failed. Check your connection and try again.'

/** Queued + running rows across every team. Null when the RPC errors. */
export async function fetchQueueDepth(): Promise<number | null> {
  if (!supabase) return null
  const { data, error } = await supabase.rpc('scoring_queue_depth')
  return error || data == null ? null : Number(data)
}

export async function uploadSubmission(
  teamId: string,
  files: SubmissionFiles,
  source: 'upload' | 'playground' = 'upload',
): Promise<SubmissionRow> {
  if (!supabase) throw new Error('backend')
  const depth = await fetchQueueDepth()
  if (depth != null && depth >= QUEUE_CAP) throw new Error(QUEUE_FULL_MESSAGE)
  const id = crypto.randomUUID()
  const searchPath = `${teamId}/${id}/search.py`
  const tiebreakerPath = `${teamId}/${id}/tiebreaker.py`
  for (const [path, file] of [
    [searchPath, files.search],
    [tiebreakerPath, files.tiebreaker],
  ] as const) {
    // The bucket only accepts text/x-python, and browsers report .py files inconsistently.
    const body = new Blob([file], { type: 'text/x-python' })
    const up = await supabase.storage.from('submissions').upload(path, body, {
      contentType: 'text/x-python',
      upsert: false,
    })
    if (up.error) throw new Error(friendlyStorageError(up.error) ?? UPLOAD_FAILED)
  }
  const inserted = await supabase
    .from('submissions')
    .insert({
      id,
      team_id: teamId,
      source,
      file_path: searchPath,
      file_name: files.search.name,
      size_bytes: files.search.size,
      tiebreaker_path: tiebreakerPath,
      tiebreaker_size_bytes: files.tiebreaker.size,
    })
    .select('*')
    .single()
  if (inserted.error) throw new Error(friendlyDbError(inserted.error) ?? UPLOAD_FAILED)
  return inserted.data
}

export async function downloadSubmissionFiles(row: Pick<SubmissionRow, 'file_path' | 'tiebreaker_path'>): Promise<{
  search: string
  tiebreaker: string
}> {
  const [search, tiebreaker] = await Promise.all([downloadSubmission(row.file_path), downloadSubmission(row.tiebreaker_path)])
  return { search, tiebreaker }
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
  const removed = await supabase.storage.from('avatars').remove([path])
  if (removed.error) throw new Error("Couldn't remove the avatar. Try again.")
  const updated = await supabase.from('teams').update({ avatar_path: null }).eq('id', teamId).select('id')
  if (updated.error || !updated.data?.length) throw new Error("Couldn't remove the avatar. Try again.")
}

export async function updateTeamName(teamId: string, teamName: string): Promise<void> {
  if (!supabase) throw new Error('backend')
  const { data, error } = await supabase.from('teams').update({ team_name: teamName }).eq('id', teamId).select('id')
  if (error) {
    if (/unique|duplicate|already/i.test(error.message)) throw new Error('Another team already uses that name.')
    if (error.code === '23514') throw new Error('Use 2 to 40 characters for the team name.')
    throw new Error(error.message)
  }
  // RLS turns a blocked update into zero rows, not an error.
  if (!data?.length) throw new Error("Couldn't save the name. Try again.")
}

export async function fetchTeam(teamId: string): Promise<Tables<'teams'> | null> {
  if (!supabase) return null
  const { data } = await supabase.from('teams').select('*').eq('id', teamId).maybeSingle()
  return data
}

/** Admin only: the edge function checks the caller's JWT and only resets team accounts. */
export async function resetTeamPassword(username: string, password: string): Promise<void> {
  if (!supabase) throw new Error('backend')
  const { error } = await supabase.functions.invoke('admin-manage-teams', {
    body: { action: 'reset_password', username, password },
  })
  if (!error) return
  const context = (error as { context?: Response }).context
  const payload = context ? ((await context.json().catch(() => ({}))) as { error?: string }) : {}
  if (payload.error === 'invalid_password') throw new Error('Use at least 8 characters.')
  if (payload.error === 'not_a_team_account') throw new Error('Only team passwords can be reset here.')
  throw new Error("Couldn't update the password. Try again.")
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
