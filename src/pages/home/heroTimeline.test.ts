import { describe, expect, it } from 'vitest'
import { nodeElapsed, reachTime } from '@/pages/home/heroTimeline'

/** Badge distances along the Appendix A polyline (length 3885). */
const fractions = [0, 661 / 3885, 1083 / 3885, 1785 / 3885, 2524 / 3885, 3071 / 3885, 1]
const reaches = [0.62, 1.102, 1.188, 1.291, 1.387, 1.484, 2]
const elapsed = ['0.00', '0.48', '0.57', '0.67', '0.77', '0.86', '1.38']

describe('hero intro reach times', () => {
  it('matches the 1280 reference within 0.01s', () => {
    fractions.forEach((fraction, index) => {
      const reach = reachTime(fraction)
      expect(Math.abs(reach - reaches[index]!)).toBeLessThanOrEqual(0.01)
      expect(nodeElapsed(reach)).toBe(elapsed[index])
    })
  })
})
