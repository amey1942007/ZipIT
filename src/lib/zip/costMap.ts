import { buildNeighbors } from '@/lib/vendor/zip-solver/solver'
import { cellRc, type ZipPuzzle } from '@/lib/zip/types'

/** Placeholder cost: BFS distance to the next number. null means "do not step here". */
export function buildCostMap(
  puzzle: ZipPuzzle,
  path: readonly number[],
  bans: ReadonlySet<number>,
  nextWaypoint: number,
): (number | null)[][] {
  const { rows, cols, waypoints, walls } = puzzle
  const total = rows * cols
  const order = new Int16Array(total)
  waypoints.forEach((cell, index) => {
    order[cell] = index + 1
  })
  const visited = new Uint8Array(total)
  for (const cell of path) visited[cell] = 1
  const target = nextWaypoint >= 1 && nextWaypoint <= waypoints.length ? waypoints[nextWaypoint - 1]! : -1
  const neighbors = buildNeighbors(rows, cols, walls)
  const dist = new Int16Array(total).fill(-1)

  const allowed = (cell: number): boolean => {
    if (visited[cell]) return false
    const number = order[cell] ?? 0
    return number === 0 || number === nextWaypoint
  }

  if (target >= 0 && allowed(target)) {
    const queue = [target]
    dist[target] = 0
    for (let head = 0; head < queue.length; head++) {
      const cell = queue[head]!
      for (const next of neighbors[cell] ?? []) {
        if (dist[next] !== -1 || !allowed(next)) continue
        dist[next] = dist[cell]! + 1
        queue.push(next)
      }
    }
  }

  const grid: (number | null)[][] = []
  for (let r = 0; r < rows; r++) {
    const row: (number | null)[] = []
    for (let c = 0; c < cols; c++) {
      const index = r * cols + c
      if (visited[index] || bans.has(index) || dist[index] < 0) row.push(null)
      else row.push(dist[index]!)
    }
    grid.push(row)
  }
  return grid
}

export function numbersGrid(puzzle: ZipPuzzle): number[][] {
  const grid = Array.from({ length: puzzle.rows }, () => Array.from({ length: puzzle.cols }, () => 0))
  puzzle.waypoints.forEach((cell, index) => {
    const [r, c] = cellRc(cell, puzzle.cols)
    grid[r]![c] = index + 1
  })
  return grid
}
