// Adapted from ThVerg/AiZipSolve@63cfd1df3d4d83e6ecc69154d167ab47e6516ad1
// zipsolve/generator.py _puzzle_from_path uniqueness loop
// (MIT, Copyright (c) 2026 ThVerg). See ./LICENSE.
// The oracle is chi-feng's solver (limit 2) instead of AiZipSolve's find_solutions.

import { randint } from '@/lib/zip/rng'
import { solve } from '@/lib/vendor/zip-solver/solver'

function quantile(values: number[], q: number): number {
  const sorted = values.slice().sort((a, b) => a - b)
  if (sorted.length === 0) return 0
  const pos = (sorted.length - 1) * q
  const base = Math.floor(pos)
  const rest = pos - base
  const left = sorted[base]!
  const right = sorted[Math.min(base + 1, sorted.length - 1)]!
  return left + rest * (right - left)
}

function visitsInOrder(path: readonly number[], waypoints: readonly number[]): boolean {
  let want = 0
  for (const cell of path) {
    if (want < waypoints.length && cell === waypoints[want]) want++
  }
  return (
    want === waypoints.length && path[path.length - 1] === waypoints[waypoints.length - 1]
  )
}

export interface UniquenessInput {
  rows: number
  cols: number
  path: readonly number[]
  waypoints: number[]
  walls: readonly string[]
  rng: () => number
  maxNodes: number
  deadline: number
}

/** Add checkpoints from `path` until the solver proves a unique solution. */
export function enforceUnique(input: UniquenessInput): number[] | null {
  const { rows, cols, path, walls, rng, maxNodes, deadline } = input
  const pos = new Map(path.map((cell, index) => [cell, index]))
  let waypoints = input.waypoints.slice()

  for (let guard = 0; guard < path.length; guard++) {
    if (performance.now() > deadline) return null
    const found = solve(
      { rows, cols, waypoints, walls: walls.slice() },
      { limit: 2, maxNodes },
    )
    if (!found) return null
    if (found.solutions.length <= 1 && !found.aborted) {
      return found.solutions.length === 1 ? waypoints : null
    }
    const taken = new Set(waypoints)
    const free = path
      .map((_, index) => index)
      .filter((index) => index > 0 && index < path.length - 1 && !taken.has(path[index]!))
    if (free.length === 0) return waypoints
    const others = found.solutions.filter((solution) => solution.join() !== path.join())
    const killers: number[] = []
    if (others.length > 0) {
      const alt = others[0]!
      for (const index of free) {
        const trial = [...waypoints.map((cell) => pos.get(cell)!), index].sort((a, b) => a - b)
        const trialWaypoints = trial.map((i) => path[i]!)
        if (!visitsInOrder(alt, trialWaypoints)) killers.push(index)
      }
    }
    let added: number
    if (killers.length > 0) {
      const existing = waypoints.map((cell) => pos.get(cell)!)
      const dist = killers.map((index) => Math.min(...existing.map((at) => Math.abs(index - at))))
      const cut = quantile(dist, 0.75)
      const top = killers.filter((_, i) => dist[i]! >= cut)
      added = top[randint(rng, 0, top.length - 1)]!
    } else {
      const idxs = waypoints.map((cell) => pos.get(cell)!).sort((a, b) => a - b)
      const gaps: Array<[number, number, number]> = []
      for (let i = 0; i < idxs.length - 1; i++) {
        const left = idxs[i]!
        const right = idxs[i + 1]!
        if (right - left > 1) gaps.push([right - left, left, right])
      }
      if (gaps.length === 0) return waypoints
      const big = Math.max(...gaps.map((gap) => gap[0]))
      const cands = gaps.filter((gap) => gap[0] === big)
      const picked = cands[randint(rng, 0, cands.length - 1)]!
      const span = picked[2] - picked[1]
      const lo = picked[1] + Math.max(1, Math.floor(span / 4))
      const hi = picked[2] - Math.max(1, Math.floor(span / 4))
      added = randint(rng, lo, Math.max(lo, hi))
    }
    const merged = [...waypoints.map((cell) => pos.get(cell)!), added].sort((a, b) => a - b)
    waypoints = merged.map((index) => path[index]!)
  }
  return waypoints
}
