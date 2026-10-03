import { describe, expect, it } from 'vitest'
import { decodeTrace, TRACE_BACKTRACK, TRACE_TIE, traceLayout } from '@/arena/engineCore'
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
  scores: [0, 5, 7, Number.NaN, 2.5],
  flags: [0, 0, 0, TRACE_BACKTRACK, TRACE_TIE],
}

/** Same layout as zipit_runtime._Trace.as_bytes. */
function encode(raw: typeof RAW): Uint8Array {
  const size = raw.heads.length
  const layout = traceLayout(size)
  const bytes = new Uint8Array(layout.total)
  const view = new DataView(bytes.buffer)
  bytes.set([0x5a, 0x54, 0x52, 0x31])
  view.setUint32(4, size, true)
  raw.heads.forEach((value, k) => view.setUint16(layout.heads + 2 * k, value, true))
  raw.parents.forEach((value, k) => view.setInt32(layout.parents + 4 * k, value, true))
  raw.scores.forEach((value, k) => view.setFloat64(layout.scores + 8 * k, value, true))
  raw.flags.forEach((value, k) => view.setUint8(layout.flags + k, value))
  return bytes
}

describe('search trace', () => {
  it('rejects malformed logs', () => {
    expect(decodeTrace(new Uint8Array(0), 9)).toBeNull()
    expect(decodeTrace(encode(RAW).slice(0, -1), 9)).toBeNull()
    const badMagic = encode(RAW)
    badMagic[0] = 0
    expect(decodeTrace(badMagic, 9)).toBeNull()
    expect(decodeTrace(encode({ ...RAW, heads: [0, 1, 2, 3, 9] }), 9)).toBeNull()
    expect(decodeTrace(encode({ ...RAW, parents: [-1, 0, 3, 0, 3] }), 9)).toBeNull()
    expect(decodeTrace(encode({ ...RAW, parents: [0, 0, 1, 0, 3] }), 9)).toBeNull()
    expect(decodeTrace(encode({ ...RAW, parents: [-1, -1, 1, 0, 3] }), 9)).toBeNull()
    expect(decodeTrace(encode({ ...RAW, flags: [0, 0, 0, 4, 0] }), 9)).toBeNull()
  })

  it('reads a log that does not start on an 8-byte boundary', () => {
    const bytes = encode(RAW)
    const shifted = new Uint8Array(bytes.length + 3)
    shifted.set(bytes, 3)
    expect(decodeTrace(shifted.subarray(3), 9)?.heads[4]).toBe(4)
  })

  it('rebuilds each expanded path from parents', () => {
    const trace = decodeTrace(encode(RAW), 9)!
    expect(nodePath(trace, 2)).toEqual([0, 1, 2])
    expect(nodePath(trace, 4)).toEqual([0, 3, 4])
    expect(Number.isNaN(trace.scores[3])).toBe(true)
  })

  it('marks the jump and keeps the abandoned branch hatched until the next jump', () => {
    const index = indexTrace(decodeTrace(encode(RAW), 9)!)
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
