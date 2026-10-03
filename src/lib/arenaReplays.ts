import { asResult, type EngineResult } from '@/arena/engineCore'
import type { Json } from '@/lib/database.types'
import { buildSlots, type SlotSubmission } from '@/lib/slots'
import { supabase } from '@/lib/supabase'
import { cellRc } from '@/lib/zip/types'
import type { GeneratedPuzzle } from '@/lib/zip/generate'

/** Saved per submission: the current Zip and the one before it. */
export type ReplaySlot = 'current' | 'previous'

export interface SavedReplay {
  slot: ReplaySlot
  createdAt: string
  puzzle: GeneratedPuzzle
  result: EngineResult
}

/** Matches save_arena_replay: replays are kept for the runs in the BEST, 2ND, 3RD and LATEST slots. */
export function replayKeepIds(rows: SlotSubmission[]): string[] {
  const ids = buildSlots(rows).flatMap((slot) => (slot.submission ? [slot.submission.id] : []))
  return [...new Set(ids)]
}

/** What the table stores next to the binary log; asResult reads it back. */
export function replaySummary(result: EngineResult, cols: number) {
  return {
    status: result.status,
    error: result.error,
    path: result.path.map((cell) => [...cellRc(cell, cols)]),
    stats: JSON.parse(JSON.stringify(result.stats)) as Json,
  }
}

function isIntArray(value: unknown, min: number, max: number): value is number[] {
  return Array.isArray(value) && value.every((item) => Number.isInteger(item) && item >= min && item < max)
}

export function asSavedPuzzle(value: unknown): GeneratedPuzzle | null {
  const raw = (value ?? {}) as Partial<GeneratedPuzzle>
  const { rows, cols, waypoints, walls, seed } = raw
  if (!Number.isInteger(rows) || !Number.isInteger(cols) || rows! < 2 || cols! < 2 || rows! > 16 || cols! > 16) return null
  const cells = rows! * cols!
  if (!isIntArray(waypoints, 0, cells) || waypoints.length < 2) return null
  if (!Array.isArray(walls) || !walls.every((wall) => typeof wall === 'string' && /^\d+\|\d+$/.test(wall))) return null
  return { rows: rows!, cols: cols!, waypoints: [...waypoints], walls: [...walls], seed: Number.isFinite(seed) ? seed! : 0 }
}

async function gzip(bytes: Uint8Array): Promise<Blob> {
  const stream = new Blob([bytes as BlobPart]).stream().pipeThrough(new CompressionStream('gzip'))
  return new Blob([await new Response(stream).arrayBuffer()], { type: 'application/octet-stream' })
}

async function gunzip(blob: Blob): Promise<Uint8Array> {
  const stream = blob.stream().pipeThrough(new DecompressionStream('gzip'))
  return new Uint8Array(await new Response(stream).arrayBuffer())
}

const SAVE_FAILED = "Couldn't save this replay. It still plays here until you leave the page."

function saveError(error: { code?: string; message?: string } | null): string {
  const message = error?.message ?? ''
  if (/row-level security|unauthori[sz]ed|403/i.test(message)) {
    return 'Too many replay files are being saved right now. Try New Zip again in a few minutes.'
  }
  if (/maximum allowed size|too large|payload/i.test(message)) return 'This search log is too large to save.'
  if (error?.code === '22023' && message.startsWith('not_kept')) {
    return 'Replays are saved only for the runs in your BEST, 2ND, 3RD and LATEST slots.'
  }
  return SAVE_FAILED
}

export async function saveArenaReplay(options: {
  teamId: string
  submissionId: string
  keep: string[]
  puzzle: GeneratedPuzzle
  result: EngineResult
}): Promise<void> {
  if (!supabase) throw new Error(SAVE_FAILED)
  const { teamId, submissionId, keep, puzzle, result } = options
  if (!result.traceBytes) throw new Error('This run has no search log to save.')
  const path = `${teamId}/${submissionId}/${crypto.randomUUID()}.bin`
  const up = await supabase.storage.from('replays').upload(path, await gzip(result.traceBytes), {
    contentType: 'application/octet-stream',
    upsert: false,
  })
  if (up.error) throw new Error(saveError(up.error))
  const { error } = await supabase.rpc('save_arena_replay', {
    p_submission: submissionId,
    p_path: path,
    p_puzzle: { rows: puzzle.rows, cols: puzzle.cols, waypoints: puzzle.waypoints, walls: puzzle.walls, seed: puzzle.seed },
    p_summary: replaySummary(result, puzzle.cols),
    p_keep: keep,
  })
  if (error) throw new Error(saveError(error))
}

/** Saved replays for one submission, oldest first. Ones that fail to download or validate are left out. */
export async function fetchArenaReplays(submissionId: string): Promise<{ replays: SavedReplay[]; missing: number }> {
  if (!supabase) return { replays: [], missing: 0 }
  const client = supabase
  const { data, error } = await client
    .from('arena_replays')
    .select('slot, created_at, trace_path, puzzle, summary')
    .eq('submission_id', submissionId)
    .order('created_at', { ascending: true })
  if (error) throw error
  const loaded = await Promise.all(
    (data ?? []).map(async (row): Promise<SavedReplay | null> => {
      const puzzle = asSavedPuzzle(row.puzzle)
      if (!puzzle) return null
      const file = await client.storage.from('replays').download(row.trace_path)
      if (file.error || !file.data) return null
      const bytes = await gunzip(file.data).catch(() => null)
      if (!bytes) return null
      const result = asResult(row.summary, puzzle, bytes)
      if (!result.trace) return null
      return { slot: row.slot as ReplaySlot, createdAt: row.created_at, puzzle, result }
    }),
  )
  const replays = loaded.filter((item): item is SavedReplay => item !== null)
  return { replays, missing: loaded.length - replays.length }
}
