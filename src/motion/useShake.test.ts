import { describe, expect, it } from 'vitest'
import { shakeSamples } from '@/motion/useShake'

describe('shake samples', () => {
  it('starts at x 0 and ends at rest', () => {
    const frames = shakeSamples(7, 350)
    expect(frames).toHaveLength(30)
    expect(frames[0]?.x).toBeCloseTo(0, 6)
    expect(frames[0]?.y).toBeCloseTo(7, 6)
    expect(frames[29]?.x).toBeCloseTo(0, 6)
    expect(frames[29]?.y).toBeCloseTo(0, 6)
  })
})
