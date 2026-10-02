export type TurnKind = 'turn' | 'slide' | 'fade' | 'cut' | 'none'

export interface KindInput {
  first: boolean
  reduced: boolean
  active: boolean
  sinceLastMs: number
  sameKey: boolean
  navType: 'PUSH' | 'REPLACE' | 'POP'
  key: string
  prevKey: string
  ziTurn: boolean
  mobile: boolean
}

export function decideKind(input: KindInput): TurnKind {
  if (input.first) return 'none'
  if (input.reduced) return 'cut'
  if (input.active || input.sinceLastMs < 600) return 'cut'
  if (input.sameKey) return 'none'
  // Guard <Navigate replace> must not curl, including when leaving admin.
  if (input.navType === 'REPLACE' && !input.ziTurn) return 'cut'
  if (input.navType === 'POP') return 'fade'
  if (input.key === 'admin' || input.prevKey === 'admin' || input.key === 'notfound' || input.prevKey === 'notfound') {
    return 'fade'
  }
  if (input.mobile) return 'slide'
  return 'turn'
}

export function turnKey(path: string): string {
  if (path === '/login') return 'login'
  if (path === '/') return 'home'
  if (path === '/submissions') return 'submissions'
  if (path === '/leaderboard') return 'leaderboard'
  if (path === '/profile') return 'profile'
  if (path.startsWith('/arena')) return 'arena'
  if (path.startsWith('/admin')) return 'admin'
  return 'notfound'
}

const hypot = Math.hypot(1, 0.72)
export const FOLD_N = { x: 1 / hypot, y: 0.72 / hypot }

export function dMax(width: number, height: number): number {
  return width * FOLD_N.x + height * FOLD_N.y
}

export type Poly = Array<[number, number]>

function side(point: [number, number], c: number, keep: boolean): number {
  return (point[0] * FOLD_N.x + point[1] * FOLD_N.y - c) * (keep ? 1 : -1)
}

export function clipHalfPlane(poly: Poly, c: number, keep: boolean): Poly {
  const out: Poly = []
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i]!
    const b = poly[(i + 1) % poly.length]!
    const fa = side(a, c, keep)
    const fb = side(b, c, keep)
    if (fa <= 0) out.push(a)
    if ((fa < 0 && fb > 0) || (fa > 0 && fb < 0)) {
      const u = fa / (fa - fb)
      out.push([a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u])
    }
  }
  return out
}

export function reflectPoint(point: [number, number], c: number): [number, number] {
  const d = point[0] * FOLD_N.x + point[1] * FOLD_N.y - c
  return [point[0] - 2 * d * FOLD_N.x, point[1] - 2 * d * FOLD_N.y]
}

export function curlPolygons(width: number, height: number, c: number): { keep: Poly; flap: Poly; shadow: Poly } {
  const rect: Poly = [
    [0, 0],
    [width, 0],
    [width, height],
    [0, height],
  ]
  const gone = clipHalfPlane(rect, c, false)
  return {
    keep: clipHalfPlane(rect, c, true),
    flap: gone.map((point) => reflectPoint(point, c)),
    shadow: clipHalfPlane(clipHalfPlane(rect, c, false), c + 90, true),
  }
}

export function polygonCss(points: Poly): string {
  if (points.length < 3) return 'polygon(0 0, 0 0, 0 0)'
  return `polygon(${points.map((point) => `${point[0].toFixed(1)}px ${point[1].toFixed(1)}px`).join(',')})`
}

export const transitionBus: {
  navId: string
  turnKey: string
  kind: TurnKind
  lastStart: number
  active: { complete: () => void } | null
} = {
  navId: '',
  turnKey: '',
  kind: 'none',
  lastStart: Number.NEGATIVE_INFINITY,
  active: null,
}

export function syncTransition(navId: string, path: string, navType: 'PUSH' | 'REPLACE' | 'POP', state: unknown): TurnKind {
  if (transitionBus.navId === navId) return transitionBus.kind
  const key = turnKey(path)
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const mobile = window.matchMedia('(max-width: 639px)').matches
  const ziTurn = Boolean(state && typeof state === 'object' && 'ziTurn' in state && (state as { ziTurn?: boolean }).ziTurn)
  const kind = decideKind({
    first: transitionBus.turnKey === '',
    reduced,
    active: Boolean(transitionBus.active),
    sinceLastMs: performance.now() - transitionBus.lastStart,
    sameKey: key === transitionBus.turnKey,
    navType,
    key,
    prevKey: transitionBus.turnKey,
    ziTurn,
    mobile,
  })
  if (kind === 'cut') transitionBus.active?.complete()
  transitionBus.navId = navId
  transitionBus.turnKey = key
  transitionBus.kind = kind
  if (kind === 'turn' || kind === 'slide' || kind === 'fade') transitionBus.lastStart = performance.now()
  return kind
}
