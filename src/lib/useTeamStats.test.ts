import { describe, expect, it } from 'vitest'
import { deltaSign, rankOf, shouldCelebrateBest } from '@/lib/useTeamStats'

describe('team stats mapping', () => {
  const rows = [
    { team_id: 'a' },
    { team_id: 'b' },
    { team_id: 'c' },
  ]

  it('ranks by sorted index, matching the leaderboard', () => {
    expect(rankOf(rows, 'b')).toBe(2)
    expect(rankOf(rows, 'missing')).toBeNull()
  })

  it('does not celebrate the first load and suppresses a frozen board', () => {
    const next = { previousId: null, nextId: 's1', previousScore: null, nextScore: 10, introPlaying: false }
    expect(shouldCelebrateBest({ ...next, first: true, frozen: false })).toBe(false)
    expect(shouldCelebrateBest({ ...next, first: false, frozen: true })).toBe(false)
    expect(shouldCelebrateBest({ ...next, first: false, frozen: false })).toBe(true)
  })

  it('signs rank deltas and a first placement', () => {
    expect(deltaSign(null, null)).toBeNull()
    expect(deltaSign(null, 4)).toBe('new')
    expect(deltaSign(5, 2)).toBe('up')
    expect(deltaSign(2, 6)).toBe('down')
    expect(deltaSign(3, 3)).toBeNull()
  })
})
