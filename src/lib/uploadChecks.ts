import { PY_EXT, UPLOAD_MAX_BYTES } from '@/config/site'

export interface UploadCheckInput {
  names: string[]
  name: string
  size: number
}

/** Client checks in spec order. The first failure stops the upload. */
export function firstUploadError(input: UploadCheckInput): string | null {
  if (input.names.length > 1) return 'Upload one file at a time.'
  if (!PY_EXT.test(input.name)) {
    return 'Only .py files can be uploaded. Rename the file so it ends in lowercase .py.'
  }
  if (input.size === 0) return 'That file is empty.'
  if (input.size > UPLOAD_MAX_BYTES) return 'That file is over 256 KB. Upload a smaller .py file.'
  return null
}
