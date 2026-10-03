import { GRADING_LIMITS, type EngineLimits, type EngineResult } from '@/arena/engineCore'

export interface GradingVerdict {
  counts: boolean
  reasons: string[]
}

const fmt = (value: number) => value.toLocaleString('en-IN')

/**
 * Would the scorer accept this board? Expansions are exact (same engine, same order).
 * Time is a browser measurement, so it is only an estimate of the scoring machine.
 */
export function gradingVerdict(result: EngineResult, arena: EngineLimits, grading: EngineLimits = GRADING_LIMITS): GradingVerdict {
  const reasons: string[] = []
  const expansions = result.stats.expansions
  const elapsed = result.stats.elapsed
  if (result.status === 'error') {
    reasons.push(`Your code crashed${result.error ? `: ${result.error}` : ''}. The scorer marks a crash as failed.`)
  } else if (result.status === 'timeout') {
    reasons.push(`The run was stopped after ${Math.round(arena.hardTimeoutMs / 1000)} s without finishing.`)
  } else if (result.status === 'exhausted') {
    reasons.push('The search ran out of paths without covering every cell.')
  } else if (result.status === 'expansion_limit') {
    reasons.push(`The search hit the Arena ceiling of ${fmt(arena.maxExpansions)} expansions without solving the board.`)
  } else if (result.status === 'time_limit') {
    reasons.push(`The search hit the Arena ceiling of ${arena.timeLimitS} s without solving the board.`)
  }
  if (typeof expansions === 'number' && expansions > grading.maxExpansions) {
    reasons.push(
      `It used ${fmt(expansions)} expansions. The scorer stops at ${fmt(grading.maxExpansions)}, so this board would count as unsolved.`,
    )
  }
  if (typeof elapsed === 'number' && elapsed > grading.timeLimitS) {
    reasons.push(
      `It took ${elapsed.toFixed(1)} s here. The scorer stops at ${grading.timeLimitS} s. Your browser runs at a different speed from the scoring machine, so treat the time as an estimate.`,
    )
  }
  return { counts: reasons.length === 0 && result.solved, reasons }
}
