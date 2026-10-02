import { PY_EXT, UPLOAD_MAX_BYTES } from '@/config/site'

export interface UploadCheckInput {
  names: string[]
  name: string
  size: number
}

export type UploadCheckId = 'count' | 'ext' | 'empty' | 'size'

const EXT_MESSAGE = 'Only .py files can be uploaded. Rename the file so it ends in lowercase .py.'
const SIZE_MESSAGE = 'That file is over 256 KB. Upload a smaller .py file.'

/** Same order and copy as `firstUploadError`. */
export function uploadCheckList(input: UploadCheckInput): { id: UploadCheckId; ok: boolean; message: string }[] {
  return [
    { id: 'count', ok: input.names.length <= 1, message: 'Upload one file at a time.' },
    { id: 'ext', ok: PY_EXT.test(input.name), message: EXT_MESSAGE },
    { id: 'empty', ok: input.size > 0, message: 'That file is empty.' },
    { id: 'size', ok: input.size <= UPLOAD_MAX_BYTES, message: SIZE_MESSAGE },
  ]
}

/** Client checks in spec order. The first failure stops the upload. */
export function firstUploadError(input: UploadCheckInput): string | null {
  return uploadCheckList(input).find((check) => !check.ok)?.message ?? null
}
