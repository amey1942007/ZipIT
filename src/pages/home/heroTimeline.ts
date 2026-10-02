/** Cubic bezier y(x) for unit control points. */
export function cubicBezier(x1: number, y1: number, x2: number, y2: number): (x: number) => number {
  const at = (t: number, a: number, b: number) => {
    const u = 1 - t
    return 3 * u * u * t * a + 3 * u * t * t * b + t * t * t
  }
  return (x: number) => {
    if (x <= 0) return 0
    if (x >= 1) return 1
    let lo = 0
    let hi = 1
    for (let i = 0; i < 24; i++) {
      const mid = (lo + hi) / 2
      if (at(mid, x1, x2) < x) lo = mid
      else hi = mid
    }
    return at((lo + hi) / 2, y1, y2)
  }
}

export const scanEase = cubicBezier(0.65, 0, 0.35, 1)

export function scanInv(progress: number): number {
  if (progress <= 0) return 0
  if (progress >= 1) return 1
  let lo = 0
  let hi = 1
  for (let i = 0; i < 24; i++) {
    const mid = (lo + hi) / 2
    if (scanEase(mid) < progress) lo = mid
    else hi = mid
  }
  return (lo + hi) / 2
}

export const INTRO_END = 3.05

export function reachTime(distanceFraction: number): number {
  return 0.62 + 1.38 * scanInv(distanceFraction)
}

export function nodeElapsed(reach: number): string {
  return Math.max(0, reach - 0.62).toFixed(2)
}

export function pathProgress(t: number): number {
  if (t <= 0.62) return 0
  if (t >= 2) return 1
  return scanEase((t - 0.62) / 1.38)
}

export function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value))
}
