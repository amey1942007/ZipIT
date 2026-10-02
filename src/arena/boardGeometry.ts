/** Preferred cell edge from the Arena size table (§5.6.4). 6×6 is 52 mobile / 84 desktop. */
export const CELL_TABLE: Record<number, { mobile: number; desktop: number }> = {
  5: { mobile: 64, desktop: 96 },
  6: { mobile: 52, desktop: 84 },
  7: { mobile: 44, desktop: 72 },
  8: { mobile: 40, desktop: 64 },
}

export const CELL_MIN = 32
/** Inner padding on each side. 6×84 + 2×12 = 528. */
export const BOARD_PAD = 12

export type BoardBreakpoint = 'mobile' | 'desktop'

/**
 * cell = max(32, min(table[n][bp], floor((boardMax − 2·pad) / n)))
 * `boardMax` is the width available for the padded board.
 */
export function cellSize(n: number, breakpoint: BoardBreakpoint, boardMax: number, pad = BOARD_PAD): number {
  const preferred = CELL_TABLE[n]?.[breakpoint] ?? CELL_TABLE[6]![breakpoint]
  const fit = Math.floor((boardMax - 2 * pad) / Math.max(1, n))
  return Math.max(CELL_MIN, Math.min(preferred, fit))
}

export function boardOuterWidth(n: number, cell: number, pad = BOARD_PAD): number {
  return n * cell + 2 * pad
}

/** Centres of the current path, in order. One point at step 0 (waypoint 1 only). */
export function polylinePoints(path: readonly number[], cols: number, cell: number): Array<[number, number]> {
  return path.map((index) => {
    const col = index % cols
    const row = Math.floor(index / cols)
    return [col * cell + cell / 2, row * cell + cell / 2]
  })
}
