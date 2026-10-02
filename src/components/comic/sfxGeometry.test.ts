import { describe, expect, it } from 'vitest'
import { burstPoints, hash, speedLines } from '@/components/comic/sfxGeometry'

describe('sfx geometry', () => {
  it('hashes into the unit interval and stays stable', () => {
    const value = hash(3)
    expect(value).toBeGreaterThanOrEqual(0)
    expect(value).toBeLessThan(1)
    expect(hash(3)).toBe(value)
  })

  it('builds a 32-point burst, wide on x, from the appendix radii', () => {
    const pts = burstPoints(3, 150)
    expect(pts).toHaveLength(32)
    const outer = hash(300)
    const outerR = 150 * (0.95 + 0.22 * outer)
    expect(pts[0][0]).toBeCloseTo(Math.cos(-Math.PI / 2) * outerR * 1.35, 6)
    expect(pts[0][1]).toBeCloseTo(Math.sin(-Math.PI / 2) * outerR, 6)
    const inner = hash(301)
    const innerR = 150 * (0.62 + 0.08 * inner)
    const angle = Math.PI / 16 - Math.PI / 2
    expect(pts[1][0]).toBeCloseTo(Math.cos(angle) * innerR * 1.35, 6)
    expect(pts[1][1]).toBeCloseTo(Math.sin(angle) * innerR, 6)
  })

  it('draws 26 speed lines and paints every third one ivory', () => {
    const lines = speedLines(3, 150)
    expect(lines).toHaveLength(26)
    expect(lines[0]?.color).toBe('#FFF6E8')
    expect(lines[1]?.color).toBe('#FFC83D')
    expect(lines[3]?.color).toBe('#FFF6E8')
    expect(lines[0]?.width).toBeGreaterThanOrEqual(2)
    expect(lines[0]?.width).toBeLessThanOrEqual(6)
  })

  it('can drop to 14 lines under 640px', () => {
    expect(speedLines(11, 44, 14)).toHaveLength(14)
  })
})
