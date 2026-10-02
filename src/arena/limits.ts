export const HARD_STEP_CAP = 15_000
export const MAX_INVALID = 2_000
export const MAX_CONSECUTIVE_INVALID = 3
export const MAX_CELLS = 64
export const DEFAULT_TIMEOUT_MS = 10_000
export const LOAD_TIMEOUT_MS = 90_000
export const MIN_GRID = 5
export const MAX_GRID = 8

export interface RunLimits {
  timeout_ms: number
  max_steps: number
  max_invalid: number
  max_consecutive_invalid: number
  max_cells: number
}

export function defaultLimits(): RunLimits {
  return {
    timeout_ms: DEFAULT_TIMEOUT_MS,
    max_steps: HARD_STEP_CAP,
    max_invalid: MAX_INVALID,
    max_consecutive_invalid: MAX_CONSECUTIVE_INVALID,
    max_cells: MAX_CELLS,
  }
}

export function clampLimits(input?: Partial<RunLimits>): RunLimits {
  const base = defaultLimits()
  return {
    timeout_ms: Math.min(Math.max(input?.timeout_ms ?? base.timeout_ms, 1), 60_000),
    max_steps: Math.min(Math.max(input?.max_steps ?? base.max_steps, 1), HARD_STEP_CAP),
    max_invalid: Math.min(Math.max(input?.max_invalid ?? base.max_invalid, 1), MAX_INVALID),
    max_consecutive_invalid: MAX_CONSECUTIVE_INVALID,
    max_cells: MAX_CELLS,
  }
}

export function gridWithinCap(rows: number, cols: number): boolean {
  return (
    Number.isInteger(rows) &&
    Number.isInteger(cols) &&
    rows >= MIN_GRID &&
    cols >= MIN_GRID &&
    rows <= MAX_GRID &&
    cols <= MAX_GRID &&
    rows * cols <= MAX_CELLS
  )
}
