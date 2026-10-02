export type RC = readonly [r: number, c: number]

/** chi-feng puzzle body. `replays.puzzle` adds `seed` (see replayContract). */
export interface ZipPuzzle {
  rows: number
  cols: number
  waypoints: number[]
  walls: string[]
}

export function cellIndex(r: number, c: number, cols: number): number {
  return r * cols + c
}

export function cellRc(index: number, cols: number): RC {
  return [Math.floor(index / cols), index % cols]
}

export function cellCount(puzzle: Pick<ZipPuzzle, 'rows' | 'cols'>): number {
  return puzzle.rows * puzzle.cols
}
