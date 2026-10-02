import { backbite, defaultMoves } from '@/lib/vendor/aizipsolve/backbite'
import { defaultNumCheckpoints, placeCheckpoints } from '@/lib/vendor/aizipsolve/checkpoints'
import { enforceUnique } from '@/lib/vendor/aizipsolve/uniqueness'
import { addWalls } from '@/lib/vendor/aizipsolve/walls'
import { findHamiltonianPath } from '@/lib/vendor/kyakub-zip-it/hamiltonian'
import { buildNeighbors } from '@/lib/vendor/zip-solver/solver'
import { mulberry32 } from '@/lib/zip/rng'
import type { ZipPuzzle } from '@/lib/zip/types'

export const MIN_GRID = 5
export const MAX_GRID = 8
export const DEFAULT_GRID = 6
export const DEFAULT_WALL_FRAC = 0.15
export const GENERATOR_NAME = 'zipit-gen'
export const GENERATOR_VERSION = '1'

export interface GenerateOptions {
  rows?: number
  cols?: number
  seed: number
  wallFrac?: number
  unique?: boolean
  timeBudgetMs?: number
  maxNodes?: number
}

export interface GeneratedPuzzle extends ZipPuzzle {
  seed: number
}

export class GenerateError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'GenerateError'
  }
}

function inRange(size: number): boolean {
  return Number.isInteger(size) && size >= MIN_GRID && size <= MAX_GRID
}

function oneAttempt(
  rows: number,
  cols: number,
  seed: number,
  wallFrac: number,
  unique: boolean,
  deadline: number,
  maxNodes: number,
): GeneratedPuzzle | null {
  if (performance.now() > deadline) return null
  const rng = mulberry32(seed)
  const path = findHamiltonianPath({ rows, cols, rng, nodeBudget: 50_000 })
  if (!path || path.length !== rows * cols) return null
  const mixed = backbite(path, buildNeighbors(rows, cols, []), rng, defaultMoves(path.length))
  if (new Set(mixed).size !== mixed.length) return null
  const checkpoints = placeCheckpoints(mixed, defaultNumCheckpoints(mixed.length, rng), rng)
  const walls = addWalls(rows, cols, mixed, wallFrac, rng)
  const waypoints = unique
    ? enforceUnique({
        rows,
        cols,
        path: mixed,
        waypoints: checkpoints,
        walls,
        rng,
        maxNodes,
        deadline,
      })
    : checkpoints
  if (!waypoints || waypoints.length < 2) return null
  return { rows, cols, waypoints, walls, seed }
}

/** Seeded Zip generator. `seed` in the result is the seed that actually finished. */
export function generatePuzzle(options: GenerateOptions): GeneratedPuzzle {
  const rows = options.rows ?? DEFAULT_GRID
  const cols = options.cols ?? DEFAULT_GRID
  if (!inRange(rows) || !inRange(cols)) {
    throw new GenerateError(`grid must be from ${MIN_GRID}×${MIN_GRID} to ${MAX_GRID}×${MAX_GRID}`)
  }
  const wallFrac = options.wallFrac ?? DEFAULT_WALL_FRAC
  const unique = options.unique ?? true
  const budget = options.timeBudgetMs ?? 2_000
  const maxNodes = options.maxNodes ?? 200_000
  const started = performance.now()
  let seed = options.seed >>> 0
  for (let attempt = 0; attempt < 6; attempt++) {
    const deadline = started + budget
    const puzzle = oneAttempt(rows, cols, seed, wallFrac, unique, deadline, maxNodes)
    if (puzzle) return puzzle
    seed = (seed + 1) >>> 0
  }
  throw new GenerateError('no unique puzzle within the time budget')
}
