// Adapted from chi-feng/zip-solver@1110841913eec0efb1044297e533e528ff1d09de solver.js
// (MIT, Copyright (c) 2026 Chi Feng). See ./LICENSE.

export interface SolverPuzzle {
  rows: number
  cols: number
  waypoints: number[]
  walls?: string[]
}

export interface SolveOptions {
  prefix?: number[]
  limit?: number
  maxNodes?: number
}

export interface SolveResult {
  solutions: number[][]
  nodes: number
  ms: number
  aborted: boolean
}

export const wallKey = (a: number, b: number): string =>
  a < b ? `${a}|${b}` : `${b}|${a}`

export function buildNeighbors(rows: number, cols: number, walls: readonly string[]): number[][] {
  const blocked = new Set(walls)
  const nbr: number[][] = Array.from({ length: rows * cols }, () => [])
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const i = r * cols + c
      if (c + 1 < cols && !blocked.has(wallKey(i, i + 1))) {
        nbr[i]!.push(i + 1)
        nbr[i + 1]!.push(i)
      }
      if (r + 1 < rows && !blocked.has(wallKey(i, i + cols))) {
        nbr[i]!.push(i + cols)
        nbr[i + cols]!.push(i)
      }
    }
  }
  return nbr
}

// Solve a puzzle. Returns null if the puzzle or prefix is malformed.
export function solve(puzzle: SolverPuzzle, opts: SolveOptions = {}): SolveResult | null {
  const { rows, cols, waypoints } = puzzle
  const N = rows * cols
  const limit = opts.limit ?? 1
  const maxNodes = opts.maxNodes ?? Infinity
  if (!waypoints || waypoints.length < 2) return null

  const nbr = buildNeighbors(rows, cols, puzzle.walls || [])
  const order = new Int16Array(N)
  waypoints.forEach((cell, i) => {
    order[cell] = i + 1
  })
  const K = waypoints.length
  const last = waypoints[K - 1]!

  const color = (i: number) => (((i / cols) | 0) + (i % cols)) & 1
  const unvis = [0, 0]
  for (let i = 0; i < N; i++) unvis[color(i)]!++

  const visited = new Uint8Array(N)
  const path: number[] = []
  const seed = opts.prefix?.length ? opts.prefix : [waypoints[0]!]
  if (seed[0] !== waypoints[0]) return null
  let next = 1
  for (const cell of seed) {
    if (visited[cell]) return null
    if (path.length && !nbr[path[path.length - 1]!]?.includes(cell)) return null
    if (order[cell]) {
      if (order[cell] !== next) return null
      next++
    }
    visited[cell] = 1
    unvis[color(cell)]!--
    path.push(cell)
  }

  const solutions: number[][] = []
  let nodes = 0
  let aborted = false
  const seen = new Uint8Array(N)

  function feasible(cur: number, nextWp: number): boolean {
    const remaining = N - path.length
    const s = color(cur) ^ 1
    if (unvis[s] !== (remaining + 1) >> 1) return false
    if (color(last) !== (remaining & 1 ? s : s ^ 1)) return false

    const w = waypoints[nextWp - 1]!
    const dist =
      Math.abs(((w / cols) | 0) - ((cur / cols) | 0)) +
      Math.abs((w % cols) - (cur % cols))
    if (dist > remaining) return false

    seen.fill(0)
    const stack: number[] = []
    for (const n of nbr[cur]!) {
      if (!visited[n]) {
        seen[n] = 1
        stack.push(n)
      }
    }
    let count = stack.length
    while (stack.length) {
      const u = stack.pop()!
      for (const v of nbr[u]!) {
        if (!visited[v] && !seen[v]) {
          seen[v] = 1
          stack.push(v)
          count++
        }
      }
    }
    if (count !== remaining) return false

    for (let u = 0; u < N; u++) {
      if (visited[u] || u === last) continue
      let deg = 0
      for (const v of nbr[u]!) if (!visited[v] || v === cur) deg++
      if (deg <= 1) return false
    }
    return true
  }

  function admissible(n: number, nextWp: number): boolean {
    if (order[n]) {
      if (order[n] !== nextWp) return false
      if (n === last && path.length + 1 !== N) return false
    }
    return true
  }

  function dfs(cur: number, nextWp: number): boolean {
    if (++nodes > maxNodes) return (aborted = true)
    if (path.length === N) {
      if (nextWp > K) solutions.push(path.slice())
      return solutions.length >= limit
    }
    if (!feasible(cur, nextWp)) return false
    const moves = nbr[cur]!.filter((n) => !visited[n] && admissible(n, nextWp))
    if (moves.length > 1) {
      const onward = (m: number) => nbr[m]!.reduce((s, v) => s + (visited[v] ? 0 : 1), 0)
      moves.sort((a, b) => onward(a) - onward(b))
    }
    for (const n of moves) {
      visited[n] = 1
      unvis[color(n)]!--
      path.push(n)
      if (dfs(n, order[n] ? nextWp + 1 : nextWp)) return true
      visited[n] = 0
      unvis[color(n)]!++
      path.pop()
    }
    return false
  }

  const t0 = performance.now()
  dfs(path[path.length - 1]!, next)
  return { solutions, nodes, ms: performance.now() - t0, aborted }
}
