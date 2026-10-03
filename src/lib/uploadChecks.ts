import { UPLOAD_MAX_BYTES } from '@/config/site'

export const SEARCH_FILE = 'search.py'
export const TIEBREAKER_FILE = 'tiebreaker.py'
export const SUBMISSION_FILES = [SEARCH_FILE, TIEBREAKER_FILE] as const

export interface UploadFileInfo {
  name: string
  size: number
}

export type UploadCheckId = 'count' | 'names' | 'empty' | 'size'

const COUNT_MESSAGE = 'Upload both files together: search.py and tiebreaker.py.'
function namesMessage(names: string[]): string {
  return `You uploaded ${names.join(' and ')}. Name the files exactly search.py and tiebreaker.py (lowercase).`
}

/** Same order and copy as `firstUploadError`. */
export function uploadCheckList(files: UploadFileInfo[]): { id: UploadCheckId; ok: boolean; message: string }[] {
  const names = files.map((file) => file.name).sort()
  const empty = files.find((file) => file.size <= 0)
  const big = files.find((file) => file.size > UPLOAD_MAX_BYTES)
  return [
    { id: 'count', ok: files.length === 2, message: COUNT_MESSAGE },
    { id: 'names', ok: names.length === 2 && names[0] === SEARCH_FILE && names[1] === TIEBREAKER_FILE, message: namesMessage(names) },
    { id: 'empty', ok: !empty, message: `${empty?.name ?? 'That file'} is empty.` },
    { id: 'size', ok: !big, message: `${big?.name ?? 'That file'} is over 256 KB. Upload a smaller file.` },
  ]
}

/** Client checks in spec order. The first failure stops the upload. */
export function firstUploadError(files: UploadFileInfo[]): string | null {
  return uploadCheckList(files).find((check) => !check.ok)?.message ?? null
}

/** Picks search.py and tiebreaker.py out of a checked list. */
export function pairFiles<T extends UploadFileInfo>(files: T[]): { search: T; tiebreaker: T } | null {
  const search = files.find((file) => file.name === SEARCH_FILE)
  const tiebreaker = files.find((file) => file.name === TIEBREAKER_FILE)
  return search && tiebreaker ? { search, tiebreaker } : null
}
