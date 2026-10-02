export interface Rect {
  x: number
  y: number
  w: number
  h: number
}

export interface Point {
  x: number
  y: number
}

export function pathLength(points: Point[]): number {
  let length = 0
  for (let i = 1; i < points.length; i++) {
    length += Math.hypot(points[i]!.x - points[i - 1]!.x, points[i]!.y - points[i - 1]!.y)
  }
  return length
}

export function pointsToD(points: Point[]): string {
  return points.map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x.toFixed(1)} ${point.y.toFixed(1)}`).join(' ')
}

/** Desktop gutter route. Rails are derived from the panel rects so the 1280 fixture matches Appendix A. */
export function desktopRoute(p: Record<string, Rect>): Point[] {
  const L = p.p1!.x - 16
  const T = p.p1!.y - 8
  const R = p.p3!.x + p.p3!.w + 16
  const B = p.p5!.y + p.p5!.h + 9
  const x75 = (p.p7!.x + p.p7!.w + p.p5!.x) / 2
  const y65 = (p.p6!.y + p.p6!.h + p.p5!.y) / 2
  const x64 = (p.p6!.x + p.p6!.w + p.p4!.x) / 2
  const y34 = (p.p3!.y + p.p3!.h + p.p4!.y) / 2
  const yEnd = (y34 + p.p6!.y + p.p6!.h) / 2
  return [
    { x: L, y: p.p1!.y + p.p1!.h / 2 },
    { x: L, y: T },
    { x: R, y: T },
    { x: R, y: B },
    { x: x75, y: B },
    { x: x75, y: y65 },
    { x: x64, y: y65 },
    { x: x64, y: y34 },
    { x: x75, y: y34 },
    { x: x75, y: yEnd },
  ]
}

export function tabletRoute(p: Record<string, Rect>): Point[] {
  const L = Math.min(p.p1!.x, p.p7!.x) - 16
  const T = p.p1!.y - 8
  const R = Math.max(p.p2!.x + p.p2!.w, p.p4!.x + p.p4!.w) + 16
  const midY = (r: Rect) => r.y + r.h / 2
  const gy = (a: Rect, b: Rect) => (a.y + a.h + b.y) / 2
  const gx = (p.p5!.x + p.p5!.w + p.p4!.x) / 2
  return [
    { x: L, y: midY(p.p1!) },
    { x: L, y: T },
    { x: p.p2!.x + p.p2!.w / 2, y: T },
    { x: R, y: T },
    { x: R, y: midY(p.p3!) },
    { x: R, y: midY(p.p4!) },
    { x: R, y: gy(p.p4!, p.p6!) },
    { x: gx, y: gy(p.p4!, p.p6!) },
    { x: gx, y: midY(p.p5!) },
    { x: gx, y: gy(p.p3!, p.p5!) },
    { x: L, y: gy(p.p3!, p.p5!) },
    { x: L, y: midY(p.p6!) },
    { x: L, y: midY(p.p7!) },
  ]
}

export function mobileRoute(p: Record<string, Rect>): Point[] {
  const L = p.p1!.x - 12
  const R = p.p1!.x + p.p1!.w + 12
  const midY = (r: Rect) => r.y + r.h / 2
  const gy = (a: Rect, b: Rect) => (a.y + a.h + b.y) / 2
  const gx = (p.p4!.x + p.p4!.w + p.p5!.x) / 2
  return [
    { x: L, y: midY(p.p1!) },
    { x: L, y: midY(p.p2!) },
    { x: L, y: midY(p.p3!) },
    { x: L, y: midY(p.p4!) },
    { x: L, y: gy(p.p4!, p.p6!) },
    { x: gx, y: gy(p.p4!, p.p6!) },
    { x: gx, y: midY(p.p5!) },
    { x: gx, y: gy(p.p3!, p.p4!) },
    { x: R, y: gy(p.p3!, p.p4!) },
    { x: R, y: midY(p.p6!) },
    { x: R, y: midY(p.p7!) },
  ]
}

export function segmentCrossesPanel(points: Point[], panels: Rect[], inset = 2): boolean {
  const boxes = panels.map((panel) => ({
    x: panel.x + inset,
    y: panel.y + inset,
    r: panel.x + panel.w - inset,
    b: panel.y + panel.h - inset,
  }))
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]!
    const b = points[i]!
    const x = (a.x + b.x) / 2
    const y = (a.y + b.y) / 2
    if (boxes.some((box) => x > box.x && x < box.r && y > box.y && y < box.b)) return true
  }
  return false
}

export function badgeAnchors(points: Point[], panels: Record<string, Rect>, width: number): Point[] {
  if (points.length === 0 || !panels.p1 || !panels.p2 || !panels.p3 || !panels.p5 || !panels.p6) return []
  if (width < 1024) return points.slice(0, 7)
  const top = points[1] ?? points[0]!
  const bottom = points[3] ?? points[points.length - 1]!
  const y65 = (panels.p6.y + panels.p6.h + panels.p5.y) / 2
  return [
    { x: points[0]!.x + 10, y: points[0]!.y },
    { x: panels.p2.x + panels.p2.w / 2, y: top.y },
    { x: panels.p3.x + panels.p3.w / 2, y: top.y },
    { x: bottom.x - 10, y: y65 },
    { x: panels.p5.x + panels.p5.w / 2, y: bottom.y },
    { x: panels.p6.x + panels.p6.w / 2, y: y65 },
    points[points.length - 1]!,
  ]
}

export function distanceAlong(points: Point[], target: Point): number {
  let best = 0
  let bestGap = Infinity
  let walked = 0
  for (let index = 1; index < points.length; index++) {
    const a = points[index - 1]!
    const b = points[index]!
    const len = Math.hypot(b.x - a.x, b.y - a.y)
    const u = len === 0 ? 0 : ((target.x - a.x) * (b.x - a.x) + (target.y - a.y) * (b.y - a.y)) / (len * len)
    const clamped = Math.min(1, Math.max(0, u))
    const gap = Math.hypot(a.x + (b.x - a.x) * clamped - target.x, a.y + (b.y - a.y) * clamped - target.y)
    if (gap < bestGap) {
      bestGap = gap
      best = walked + clamped * len
    }
    walked += len
  }
  return best
}

/** Badge anchors on the desktop fixture, nudged 10px inward at the viewport edges. */
export function desktopBadges(points: Point[]): Point[] {
  const top = points[1]!
  const right = points[3]!
  return [
    { x: points[0]!.x + 10, y: points[0]!.y },
    { x: 560, y: top.y },
    { x: 982, y: top.y },
    { x: right.x - 10, y: 478 },
    { x: 712, y: right.y },
    { x: 712, y: 478 },
    { x: points[points.length - 1]!.x, y: points[points.length - 1]!.y },
  ]
}
