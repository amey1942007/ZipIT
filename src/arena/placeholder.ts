import type { CostMap, GridView, Heuristic, RC } from '@/arena/referee'

/** TypeScript twin of public/demo_heuristic.py. */
export const placeholderHeuristic: Heuristic = {
  id: 'warnsdorff-cost',
  nextMove(grid: GridView, path: readonly RC[], cost: CostMap): RC {
    const head = path[path.length - 1]
    if (!head) return [0, 0]
    const [r, c] = head
    let best: { key: readonly [number, number]; cell: RC } | null = null
    for (const [nr, nc] of grid.neighbors(r, c)) {
      const cellCost = cost[nr]?.[nc]
      if (cellCost == null) continue
      let onward = 0
      for (const [ar, ac] of grid.neighbors(nr, nc)) {
        if ((ar !== r || ac !== c) && cost[ar]?.[ac] != null) onward++
      }
      const key = [onward, cellCost] as const
      if (
        !best ||
        key[0] < best.key[0] ||
        (key[0] === best.key[0] && key[1] < best.key[1])
      ) {
        best = { key, cell: [nr, nc] }
      }
    }
    return best ? best.cell : [r, c]
  },
}
