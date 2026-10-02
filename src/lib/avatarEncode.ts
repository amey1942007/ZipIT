import { AVATAR_MAX_BYTES } from '@/config/site'

export const AVATAR_TYPE_ERROR = 'Use a PNG, JPEG or WebP image.'
export const AVATAR_SIZE_ERROR = 'That image is over 2 MB. Choose a smaller one.'
export const AVATAR_CONVERT_ERROR =
  "This browser couldn't convert the image. Try a different image or another browser."
export const AVATAR_PREPARING = 'Preparing image…'
export const AVATAR_SAVED = 'Avatar updated.'
export const AVATAR_CHECK_ERROR = "Couldn't save the avatar. Try again."

const ALLOWED = new Set(['image/png', 'image/jpeg', 'image/jpg', 'image/webp'])

export function isWebpRiff(bytes: Uint8Array): boolean {
  return (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  )
}

export function avatarObjectPath(teamId: string): string {
  return `${teamId}/avatar.webp`
}

export interface EncodedAvatar {
  blob: Blob
  bytes: Uint8Array
  usedFallback: boolean
}

export interface EncodeHooks {
  decode: (file: Blob) => Promise<ImageBitmap>
  paint: (bitmap: ImageBitmap) => Promise<{ blob: Blob; imageData: ImageData }>
  encodeFallback: (image: ImageData) => Promise<Uint8Array>
}

function declaredType(file: Blob): string {
  return file.type === 'image/jpg' ? 'image/jpeg' : file.type
}

async function defaultDecode(file: Blob): Promise<ImageBitmap> {
  if (typeof createImageBitmap === 'function') return createImageBitmap(file)
  const url = URL.createObjectURL(file)
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image()
      el.onload = () => resolve(el)
      el.onerror = () => reject(new Error('decode'))
      el.src = url
    })
    const canvas = document.createElement('canvas')
    canvas.width = image.naturalWidth
    canvas.height = image.naturalHeight
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('decode')
    ctx.drawImage(image, 0, 0)
    return await createImageBitmap(canvas)
  } finally {
    URL.revokeObjectURL(url)
  }
}

async function defaultPaint(bitmap: ImageBitmap): Promise<{ blob: Blob; imageData: ImageData }> {
  const side = 512
  const canvas = document.createElement('canvas')
  canvas.width = side
  canvas.height = side
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('canvas')
  const cover = Math.max(side / bitmap.width, side / bitmap.height)
  const dw = bitmap.width * cover
  const dh = bitmap.height * cover
  ctx.drawImage(bitmap, (side - dw) / 2, (side - dh) / 2, dw, dh)
  const imageData = ctx.getImageData(0, 0, side, side)
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/webp', 0.9))
  if (!blob) throw new Error('blob')
  return { blob, imageData }
}

/** Canvas WebP only in this prototype. A failed export surfaces the convert error. */
export async function encodeWebpFallback(_image: ImageData): Promise<Uint8Array> {
  throw new Error(AVATAR_CONVERT_ERROR)
}

/**
 * Decode, cover-crop to 512², and return a fresh WebP blob.
 * Never returns the original file bytes.
 */
export async function encodeAvatar(file: Blob, hooks?: Partial<EncodeHooks>): Promise<EncodedAvatar> {
  const type = declaredType(file)
  if (!ALLOWED.has(type) && type !== '') throw new Error(AVATAR_TYPE_ERROR)
  if (file.size < 1 || file.size > AVATAR_MAX_BYTES) throw new Error(AVATAR_SIZE_ERROR)
  const decode = hooks?.decode ?? defaultDecode
  const paint = hooks?.paint ?? defaultPaint
  const encodeFallback = hooks?.encodeFallback ?? encodeWebpFallback
  let bitmap: ImageBitmap
  try {
    bitmap = await decode(file)
  } catch {
    throw new Error(AVATAR_TYPE_ERROR)
  }
  const painted = await paint(bitmap)
  let usedFallback = false
  let bytes: Uint8Array
  if (painted.blob.type === 'image/webp') {
    bytes = new Uint8Array(await painted.blob.arrayBuffer())
  } else {
    usedFallback = true
    bytes = await encodeFallback(painted.imageData)
  }
  if (!isWebpRiff(bytes)) throw new Error(AVATAR_CONVERT_ERROR)
  const copy = Uint8Array.from(bytes)
  return { blob: new Blob([copy], { type: 'image/webp' }), bytes: copy, usedFallback }
}
