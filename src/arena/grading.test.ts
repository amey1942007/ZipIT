import { describe, expect, it } from 'vitest'
import { ARENA_LIMITS, asResult, type EngineResult } from '@/arena/engineCore'
import { gradingVerdict } from '@/arena/grading'
import type { ZipPuzzle } from '@/lib/zip/types'

const puzzle: ZipPuzzle = { rows: 2, cols: 3, waypoints: [0, 2, 3], walls: ['1|4'] }
const PATH = [[0, 0], [0, 1], [0, 2], [1, 2], [1, 1], [1, 0]]

function run(status: string, stats: EngineResult['stats'], error?: string): EngineResult {
  return asResult({ status, path: status === 'solved' ? PATH : [], stats, error }, puzzle)
}

describe('grading verdict', () => {
  it('counts a solve inside both scorer limits', () => {
    expect(gradingVerdict(run('solved', { expansions: 6, elapsed: 0.01 }), ARENA_LIMITS)).toEqual({ counts: true, reasons: [] })
  })

  it('flags a solve that needed more expansions than the scorer allows', () => {
    const verdict = gradingVerdict(run('solved', { expansions: 250_000, elapsed: 5 }), ARENA_LIMITS)
    expect(verdict.counts).toBe(false)
    expect(verdict.reasons).toHaveLength(1)
    expect(verdict.reasons[0]).toContain('2,50,000')
    expect(verdict.reasons[0]).toContain('2,00,000')
  })

  it('flags a slow solve and says the time is an estimate', () => {
    const verdict = gradingVerdict(run('solved', { expansions: 1000, elapsed: 25 }), ARENA_LIMITS)
    expect(verdict.counts).toBe(false)
    expect(verdict.reasons[0]).toMatch(/25\.0 s.*20 s.*estimate/)
  })

  it('explains each way a run can end unsolved', () => {
    expect(gradingVerdict(run('error', {}, 'boom'), ARENA_LIMITS).reasons[0]).toContain('crashed: boom')
    expect(gradingVerdict(run('timeout', {}), ARENA_LIMITS).reasons[0]).toContain('75 s')
    expect(gradingVerdict(run('exhausted', { expansions: 10 }), ARENA_LIMITS).reasons[0]).toContain('ran out of paths')
    const ceiling = gradingVerdict(run('expansion_limit', { expansions: 1_000_000, elapsed: 30 }), ARENA_LIMITS)
    expect(ceiling.reasons).toHaveLength(3)
    expect(ceiling.reasons[0]).toContain('10,00,000')
    expect(gradingVerdict(run('time_limit', { expansions: 5 }), ARENA_LIMITS).reasons[0]).toContain('60 s')
  })
})
