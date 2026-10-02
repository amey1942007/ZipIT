import { describe, expect, it } from 'vitest'
import { desktopRoute, pathLength, segmentCrossesPanel, type Rect } from '@/lib/gutterRoute'

const panels: Record<string, Rect> = {
  p1: { x: 32, y: 66, w: 372, h: 218 },
  p2: { x: 420, y: 66, w: 280, h: 218 },
  p3: { x: 716, y: 66, w: 532, h: 218 },
  p4: { x: 900, y: 300, w: 348, h: 356 },
  p5: { x: 540, y: 486, w: 344, h: 170 },
  p6: { x: 540, y: 300, w: 344, h: 170 },
  p7: { x: 32, y: 300, w: 492, h: 356 },
}

const expected = [
  [16, 175],
  [16, 58],
  [1264, 58],
  [1264, 665],
  [532, 665],
  [532, 478],
  [892, 478],
  [892, 292],
  [532, 292],
  [532, 380],
]

describe('desktop gutter route', () => {
  const points = desktopRoute(panels)

  it('matches the 1280 reference vertices within 2px', () => {
    expect(points).toHaveLength(expected.length)
    points.forEach((point, index) => {
      expect(point.x).toBeCloseTo(expected[index]![0]!, 0)
      expect(Math.abs(point.x - expected[index]![0]!)).toBeLessThanOrEqual(2)
      expect(Math.abs(point.y - expected[index]![1]!)).toBeLessThanOrEqual(2)
    })
    expect(Math.abs(pathLength(points) - 3885)).toBeLessThanOrEqual(2)
  })

  it('keeps every segment midpoint out of the panels', () => {
    expect(segmentCrossesPanel(points, Object.values(panels))).toBe(false)
  })
})
