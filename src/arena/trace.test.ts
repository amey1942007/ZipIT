import { describe, expect, it } from 'vitest'
import { asTrace, TRACE_BACKTRACK, TRACE_TIE } from '@/arena/engineCore'
import { indexTrace, nodePath, traceFrame } from '@/arena/trace'

/*
 * 3×3 board, cells 0..8. Expansions:
 *   0: start at 0
 *   1: 0 → 1
 *   2: 1 → 2
 *   3: back to 0 → 3   (backtrack, abandons 1, 2)
 *   4: 3 → 4           (tie)
 */
const RAW = {
  heads: [0, 1, 2, 3, 4],
  parents: [-1, 0, 1, 0, 3],
  scores: [0, 5, 7, null, 2.5],
  flags: [0, 0, 0, TRACE_BACKTRACK, TRACE_TIE],
}

describe('search trace', () => {
  it('rejects malformed logs', () => {
    expect(asTrace(null, 9)).toBeNull()
    expect(asTrace({ ...RAW, heads: [0, 1, 2, 3, 9] }, 9)).toBeNull()
    expect(asTrace({ ...RAW, parents: [-1, 0, 3, 0, 3] }, 9)).toBeNull()
    expect(asTrace({ ...RAW, flags: [0, 0] }, 9)).toBeNull()
    expect(asTrace({ ...RAW, parents: [0, 0, 1, 0, 3] }, 9)).toBeNull()
  })

  it('rebuilds each expanded path from parents', () => {
    const trace = asTrace(RAW, 9)!
    expect(nodePath(trace, 2)).toEqual([0, 1, 2])
    expect(nodePath(trace, 4)).toEqual([0, 3, 4])
    expect(Number.isNaN(trace.scores[3])).toBe(true)
  })

  it('marks the jump and keeps the abandoned branch hatched until the next jump', () => {
    const index = indexTrace(asTrace(RAW, 9)!)
    expect(index.totalBacktracks).toBe(1)
    const before = traceFrame(index, 2, [0, 8])
    expect(before).toMatchObject({ path: [0, 1, 2], abandoned: [], jumped: false, backtracksSoFar: 0, score: 7 })
    const jump = traceFrame(index, 3, [0, 8])
    expect(jump).toMatchObject({ path: [0, 3], abandoned: [1, 2], jumped: true, backtracksSoFar: 1, head: 3 })
    const after = traceFrame(index, 4, [0, 8])
    expect(after).toMatchObject({ path: [0, 3, 4], abandoned: [1, 2], jumped: false, tie: true, score: 2.5 })
    expect(traceFrame(index, 99, [0, 8]).path).toEqual([0, 3, 4])
  })
})
