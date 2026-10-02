// Adapted from ThVerg/AiZipSolve@63cfd1df3d4d83e6ecc69154d167ab47e6516ad1
// zipsolve/generator.py _add_walls (MIT, Copyright (c) 2026 ThVerg). See ./LICENSE.

import { buildNeighbors, wallKey } from '@/lib/vendor/zip-solver/solver'

/** Walls on a fraction of the edges the solution does not use. */
export function addWalls(
  rows: number,
  cols: number,
  path: readonly number[],
  frac: number,
  rng: () => number,
): string[] {
  if (frac <= 0) return []
  const used = new Set<string>()
  for (let i = 0; i < path.length - 1; i++) used.add(wallKey(path[i]!, path[i + 1]!))
  const open = buildNeighbors(rows, cols, [])
  const free: string[] = []
  const seen = new Set<string>()
  for (let cell = 0; cell < rows * cols; cell++) {
    for (const next of open[cell] ?? []) {
      const key = wallKey(cell, next)
      if (seen.has(key) || used.has(key)) continue
      seen.add(key)
      free.push(key)
    }
  }
  const count = Math.round(frac * free.length)
  if (count <= 0) return []
  const pool = free.slice()
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    const tmp = pool[i]!
    pool[i] = pool[j]!
    pool[j] = tmp
  }
  return pool.slice(0, count).sort()
}
