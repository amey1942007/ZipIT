// Adapted from ThVerg/AiZipSolve@63cfd1df3d4d83e6ecc69154d167ab47e6516ad1
// zipsolve/generator.py default_num_checkpoints and place_checkpoints
// (MIT, Copyright (c) 2026 ThVerg). See ./LICENSE.

import { randint } from '@/lib/zip/rng'

function linspace(start: number, end: number, count: number): number[] {
  if (count <= 1) return [start]
  const out: number[] = []
  for (let i = 0; i < count; i++) out.push(start + ((end - start) * i) / (count - 1))
  return out
}

export function defaultNumCheckpoints(numNodes: number, rng: () => number): number {
  const k = Math.round(1.4 * Math.sqrt(numNodes)) + randint(rng, -1, 1)
  return Math.min(Math.max(2, k), numNodes)
}

/** Stratified checkpoints along `path`, always including both ends. */
export function placeCheckpoints(
  path: readonly number[],
  numCheckpoints: number,
  rng: () => number,
): number[] {
  const n = path.length
  const k = Math.min(Math.max(2, numCheckpoints), n)
  const inner = k - 2
  if (inner === 0) return [path[0]!, path[n - 1]!]
  const bounds = linspace(1, n - 1, inner + 1)
  const idx: number[] = []
  let loPrev = 0
  for (let j = 0; j < inner; j++) {
    let lo = Math.max(Math.ceil(bounds[j]!), loPrev + 1)
    let hi = Math.max(Math.ceil(bounds[j + 1]!) - 1, lo)
    hi = Math.min(hi, n - 2 - (inner - 1 - j))
    lo = Math.min(lo, hi)
    const x = randint(rng, lo, hi)
    idx.push(x)
    loPrev = x
  }
  return [path[0]!, ...idx.map((i) => path[i]!), path[n - 1]!]
}
