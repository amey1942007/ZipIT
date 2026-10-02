const fract = (x: number) => x - Math.floor(x)

export const hash = (n: number) => fract(Math.sin(n * 127.1 + 311.7) * 43758.5453)

export function burstPoints(seed: number, R: number, outer = [0.95, 0.22], inner = [0.62, 0.08]) {
  const pts: [number, number][] = []
  for (let i = 0; i < 32; i++) {
    const a = (i * Math.PI) / 16 - Math.PI / 2
    const j = hash(seed * 100 + i)
    const r = i % 2 === 0 ? R * (outer[0] + outer[1] * j) : R * (inner[0] + inner[1] * j)
    pts.push([Math.cos(a) * r * 1.35, Math.sin(a) * r])
  }
  return pts
}

export function speedLines(seed: number, R: number, count = 26) {
  return Array.from({ length: count }, (_, i) => {
    const h = hash(seed + i * 7.3)
    const a = (i * 2 * Math.PI) / count + 0.4 * (h - 0.5)
    const r0 = R * (1.2 + 0.2 * h)
    const len = R * (0.35 + 0.5 * hash(seed + i * 3.1))
    return {
      x1: Math.cos(a) * r0 * 1.35,
      y1: Math.sin(a) * r0,
      x2: Math.cos(a) * (r0 + len) * 1.35,
      y2: Math.sin(a) * (r0 + len),
      color: i % 3 === 0 ? '#FFF6E8' : '#FFC83D',
      width: 2 + 4 * hash(seed + i * 1.7),
    }
  })
}

export function pointsAttr(pts: [number, number][]) {
  return pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ')
}
