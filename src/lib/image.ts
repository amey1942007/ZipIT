export const AVATAR_MAX_BYTES = 2_097_152

export interface ByteFile {
  name: string
  type: string
  bytes: Uint8Array
}

export interface ImageValidation {
  ok: boolean
  errors: string[]
  mime: 'image/png' | 'image/jpeg' | 'image/webp' | null
}

function startsWith(bytes: Uint8Array, magic: readonly number[]): boolean {
  return magic.every((byte, index) => bytes[index] === byte)
}

function sniffed(bytes: Uint8Array): ImageValidation['mime'] {
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47])) return 'image/png'
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return 'image/jpeg'
  if (
    bytes.length >= 12 &&
    startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return 'image/webp'
  }
  return null
}

/** png, jpeg, or webp, at most 2 MB. */
export function validateAvatar(file: ByteFile): ImageValidation {
  const errors: string[] = []
  const mime = sniffed(file.bytes)
  if (file.bytes.length < 1 || file.bytes.length > AVATAR_MAX_BYTES) errors.push('size')
  if (!mime) errors.push('content')
  const declared = file.type === 'image/jpg' ? 'image/jpeg' : file.type
  if (declared && mime && declared !== mime) errors.push('mime')
  if (declared && !mime && declared !== 'image/png' && declared !== 'image/jpeg' && declared !== 'image/webp') {
    errors.push('mime')
  }
  return { ok: errors.length === 0, errors, mime }
}
