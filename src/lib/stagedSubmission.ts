import { SEARCH_FILE, TIEBREAKER_FILE } from '@/lib/uploadChecks'

const KEY = 'zipit.staged-submission.v1'

export interface StagedSubmission {
  search: string
  tiebreaker: string
  at: number
}

/** The Playground hands its two files to the Submissions page through sessionStorage. */
export function stageSubmission(search: string, tiebreaker: string): void {
  const staged: StagedSubmission = { search, tiebreaker, at: Date.now() }
  window.sessionStorage.setItem(KEY, JSON.stringify(staged))
}

export function readStaged(): StagedSubmission | null {
  try {
    const raw = window.sessionStorage.getItem(KEY)
    if (!raw) return null
    const value = JSON.parse(raw) as Partial<StagedSubmission>
    if (typeof value.search !== 'string' || typeof value.tiebreaker !== 'string') return null
    return { search: value.search, tiebreaker: value.tiebreaker, at: Number(value.at) || 0 }
  } catch {
    return null
  }
}

export function clearStaged(): void {
  window.sessionStorage.removeItem(KEY)
}

export function stagedFiles(staged: StagedSubmission): File[] {
  return [
    new File([staged.search], SEARCH_FILE, { type: 'text/x-python' }),
    new File([staged.tiebreaker], TIEBREAKER_FILE, { type: 'text/x-python' }),
  ]
}

/** dataTransfer type used when a staged bundle is dragged inside the page. */
export const STAGED_DRAG_TYPE = 'application/x-zipit-staged'
