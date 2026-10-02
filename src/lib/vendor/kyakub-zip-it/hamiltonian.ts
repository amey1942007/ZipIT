// Adapted from kyakub/zip-it-puzzle-game@54f2a95dad1e4a0330aaf91f1e21f25e7276bde5
// scripts/pathfinder.js findHamiltonianPath (MIT, Copyright (c) 2025 Kamran Yakub.). See ./LICENSE.
// Port adds a seeded tie-break, a node budget, and wall awareness. The initial
// ZipIT path is on an open grid; walls are applied later.

import { wallKey } from '@/lib/vendor/zip-solver/solver'

export interface HamiltonianOptions {
  rows: number
  cols: number
  rng: () => number
  walls?: readonly string[]
  nodeBudget?: number
}

function neighbors(
  cell: number,
  rows: number,
  cols: number,
  blocked: ReadonlySet<string>,
): number[] {
  const r = Math.floor(cell / cols)
  const c = cell % cols
  const out: number[] = []
  const deltas = [
    [-1, 0],
    [1, 0],
    [0, -1],
    [0, 1],
  ] as const
  for (const [dr, dc] of deltas) {
    const nr = r + dr
    const nc = c + dc
    if (nr < 0 || nc < 0 || nr >= rows || nc >= cols) continue
    const next = nr * cols + nc
    if (blocked.has(wallKey(cell, next))) continue
    out.push(next)
  }
  return out
}

function shuffle(cells: number[], rng: () => number): number[] {
  const arr = cells.slice()
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    const tmp = arr[i]!
    arr[i] = arr[j]!
    arr[j] = tmp
  }
  return arr
}

/** Warnsdorff DFS. Returns a full-grid path of cell indexes, or null. */
export function findHamiltonianPath(options: HamiltonianOptions): number[] | null {
  const { rows, cols, rng } = options
  const total = rows * cols
  const blocked = new Set(options.walls ?? [])
  const budget = options.nodeBudget ?? 100_000
  const starts = shuffle(
    Array.from({ length: total }, (_, i) => i),
    rng,
  )

  for (const start of starts) {
    const visited = new Uint8Array(total)
    const path: number[] = []
    let nodes = 0
    let exhausted = false

    const dfs = (cell: number): boolean => {
      if (++nodes > budget) {
        exhausted = true
        return false
      }
      path.push(cell)
      visited[cell] = 1
      if (path.length === total) return true
      const open = neighbors(cell, rows, cols, blocked).filter((n) => !visited[n])
      const ranked = open.map((n) => ({
        n,
        onward: neighbors(n, rows, cols, blocked).filter((v) => !visited[v]).length,
        tie: rng(),
      }))
      ranked.sort((a, b) => a.onward - b.onward || a.tie - b.tie)
      for (const step of ranked) {
        if (dfs(step.n)) return true
        if (exhausted) return false
      }
      path.pop()
      visited[cell] = 0
      return false
    }

    if (dfs(start) && path.length === total) return path.slice()
  }
  return null
}
