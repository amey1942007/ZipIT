export const PY_MAX_BYTES = 262_144

const PY_MIME = new Set([
  '',
  'text/x-python',
  'text/x-script.python',
  'text/plain',
  'application/x-python',
  'application/x-python-code',
])

export interface ByteFile {
  name: string
  type: string
  bytes: Uint8Array
}

export interface PyValidation {
  ok: boolean
  errors: string[]
  warnings: string[]
}

function startsWith(bytes: Uint8Array, magic: readonly number[]): boolean {
  if (bytes.length < magic.length) return false
  return magic.every((byte, index) => bytes[index] === byte)
}

function isWebp(bytes: Uint8Array): boolean {
  return (
    bytes.length >= 12 &&
    startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  )
}

function hasNul(bytes: Uint8Array): boolean {
  return bytes.includes(0)
}

function rejectedMagic(bytes: Uint8Array): boolean {
  if (hasNul(bytes)) return true
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47])) return true
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return true
  if (startsWith(bytes, [0x47, 0x49, 0x46, 0x38])) return true
  if (isWebp(bytes)) return true
  if (startsWith(bytes, [0x25, 0x50, 0x44, 0x46])) return true
  if (startsWith(bytes, [0x50, 0x4b, 0x03, 0x04])) return true
  if (startsWith(bytes, [0xd0, 0xcf, 0x11, 0xe0])) return true
  if (startsWith(bytes, [0xff, 0xfe]) || startsWith(bytes, [0xfe, 0xff])) return true
  if (startsWith(bytes, [0x00, 0x00, 0xfe, 0xff]) || startsWith(bytes, [0xff, 0xfe, 0x00, 0x00])) {
    return true
  }
  return false
}

/** Lowercase `.py` only, plus MIME, sniff, UTF-8, and the 256 KB cap. */
export function validatePy(file: ByteFile): PyValidation {
  const errors: string[] = []
  const warnings: string[] = []
  if (!file.name.endsWith('.py')) errors.push('extension')
  if (file.bytes.length < 1 || file.bytes.length > PY_MAX_BYTES) errors.push('size')
  if (!PY_MIME.has(file.type)) errors.push('mime')
  if (rejectedMagic(file.bytes)) errors.push('content')
  let text = ''
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(file.bytes)
  } catch {
    errors.push('utf8')
  }
  if (text && !/^class (Score|TieBreaker)\b/m.test(text)) warnings.push('no class Score or TieBreaker')
  return { ok: errors.length === 0, errors, warnings }
}
