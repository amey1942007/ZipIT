import { describe, expect, it, vi } from 'vitest'
import { AVATAR_CONVERT_ERROR, AVATAR_TYPE_ERROR, encodeAvatar, isWebpRiff } from '@/lib/avatarEncode'
import { parseSubmissionBroadcast, resetBroadcastLogForTests } from '@/lib/broadcast'
import { friendlyDbError, loginEmail } from '@/lib/format'
import { compareRanking, tiedScore } from '@/lib/ranking'
import { buildSlots } from '@/lib/slots'
import { firstUploadError } from '@/lib/uploadChecks'

const webp = new Uint8Array([
  0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50,
])

describe('upload checks', () => {
  it('stops at the first failure, in order', () => {
    expect(firstUploadError({ names: ['a.py', 'b.py'], name: 'a.py', size: 10 })).toMatch(/one file/)
    expect(firstUploadError({ names: ['A.PY'], name: 'A.PY', size: 0 })).toMatch(/lowercase \.py/)
    expect(firstUploadError({ names: ['a.Py'], name: 'a.Py', size: 4 })).toMatch(/lowercase \.py/)
    expect(firstUploadError({ names: ['a.py'], name: 'a.py', size: 0 })).toMatch(/empty/)
    expect(firstUploadError({ names: ['a.py'], name: 'a.py', size: 262_145 })).toMatch(/256 KB/)
    expect(firstUploadError({ names: ['a.py'], name: 'a.py', size: 12 })).toBeNull()
  })
})

describe('login email', () => {
  it('maps a username to the zipit.local mailbox', () => {
    expect(loginEmail('  Tony ')).toBe('tony@zipit.local')
  })
})

describe('database errors', () => {
  it('maps queue_full, 42501 and 23514', () => {
    expect(friendlyDbError({ code: 'P0001', message: 'queue_full: 3' })).toMatch(/queue is full/)
    expect(friendlyDbError({ code: '42501', message: 'new row violates' })).toMatch(/wasn't accepted/)
    expect(friendlyDbError({ code: '23514', message: 'teams_avatar_path_own' })).toMatch(/avatar/)
  })
})

describe('slots', () => {
  const row = (id: string, status: string, score: number | null, created_at: string) => ({
    id,
    status,
    score,
    created_at,
    error: status === 'failed' ? 'SyntaxError on line 12' : null,
    file_name: `${id}.py`,
    scored_at: created_at,
  })

  it('keeps the previous latest visible while a new run is scoring', () => {
    const slots = buildSlots([
      row('best', 'scored', 80, '2026-10-01T10:00:00Z'),
      row('late', 'scored', 10, '2026-10-02T10:00:00Z'),
      row('new', 'queued', null, '2026-10-02T12:00:00Z'),
    ])
    expect(slots[3]?.scoring).toBe(true)
    expect(slots[3]?.submission?.id).toBe('late')
    expect(slots[3]?.linkable).toBe(true)
    expect(slots[0]?.submission?.id).toBe('best')
  })

  it('shows a failed latest without a link, and a first-ever scoring card', () => {
    const failed = buildSlots([row('bad', 'failed', null, '2026-10-02T10:00:00Z')])
    expect(failed[3]?.linkable).toBe(false)
    expect(failed[3]?.submission?.status).toBe('failed')
    const first = buildSlots([row('new', 'running', null, '2026-10-02T10:00:00Z')])
    expect(first[0]?.firstScoring).toBe(true)
    expect(first[3]?.firstScoring).toBe(true)
  })
})

describe('ranking', () => {
  it('orders by score, then earlier time, then team id', () => {
    const rows = [
      { team_id: 'b', best_score: 10, best_scored_at: '2026-10-02T00:00:00Z' },
      { team_id: 'a', best_score: 10, best_scored_at: '2026-10-01T00:00:00Z' },
      { team_id: 'c', best_score: null, best_scored_at: null },
      { team_id: 'd', best_score: 20, best_scored_at: '2026-10-03T00:00:00Z' },
    ]
    const sorted = rows.slice().sort(compareRanking)
    expect(sorted.map((row) => row.team_id)).toEqual(['d', 'a', 'b', 'c'])
    expect(tiedScore(sorted[1]!, sorted)).toBe(true)
  })
})

describe('avatar encode', () => {
  const image = { width: 2, height: 2, data: new Uint8ClampedArray(16) } as ImageData

  it('rejects a file that does not decode', async () => {
    const encodeFallback = vi.fn()
    await expect(
      encodeAvatar(new Blob([new Uint8Array([1, 2, 3])], { type: 'image/png' }), {
        decode: async () => {
          throw new Error('bad')
        },
        encodeFallback,
      }),
    ).rejects.toThrow(AVATAR_TYPE_ERROR)
    expect(encodeFallback).not.toHaveBeenCalled()
  })

  it('uses the fallback encoder when the canvas blob is not WebP', async () => {
    const encodeFallback = vi.fn(async () => webp)
    const result = await encodeAvatar(new Blob([new Uint8Array([1])], { type: 'image/png' }), {
      decode: async () => ({}) as ImageBitmap,
      paint: async () => ({ blob: new Blob(['png'], { type: 'image/png' }), imageData: image }),
      encodeFallback,
    })
    expect(encodeFallback).toHaveBeenCalledOnce()
    expect(result.usedFallback).toBe(true)
    expect(result.blob.type).toBe('image/webp')
    expect(isWebpRiff(result.bytes)).toBe(true)
  })

  it('refuses a fallback result that is not a WebP', async () => {
    await expect(
      encodeAvatar(new Blob([new Uint8Array([1])], { type: 'image/jpeg' }), {
        decode: async () => ({}) as ImageBitmap,
        paint: async () => ({ blob: new Blob(['x'], { type: 'image/png' }), imageData: image }),
        encodeFallback: async () => new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]),
      }),
    ).rejects.toThrow(AVATAR_CONVERT_ERROR)
  })
})

describe('submission broadcast', () => {
  it('reads the record and ignores a payload with no row', () => {
    resetBroadcastLogForTests()
    const info = vi.spyOn(console, 'info').mockImplementation(() => {})
    const parsed = parseSubmissionBroadcast('INSERT', {
      operation: 'INSERT',
      record: { id: 's1', team_id: 't1', status: 'queued' },
      old_record: null,
    })
    expect(parsed?.record?.id).toBe('s1')
    expect(parsed?.operation).toBe('INSERT')
    expect(parseSubmissionBroadcast('UPDATE', { hello: true })).toBeNull()
    expect(info).toHaveBeenCalledOnce()
    info.mockRestore()
  })
})
