const scoreFormat = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 })

export function formatScore(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return '—'
  return scoreFormat.format(value)
}

function istParts(iso: string) {
  const date = new Date(iso)
  const dateFmt = new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
  const timeFmt = new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })
  const today = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
  const day = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
  return { date, dateLabel: dateFmt.format(date), time: timeFmt.format(date), sameDay: day === today }
}

/** Clock time in IST, with the date when the instant is before today in IST. */
export function formatIst(iso: string | null | undefined, withSeconds = false): string {
  if (!iso) return '—'
  const parts = istParts(iso)
  const [hour, minute, second] = parts.time.split(':')
  const clock = withSeconds ? `${hour}:${minute}:${second}` : `${hour}:${minute}`
  if (parts.sameDay) return `${clock} IST`
  return `${parts.dateLabel.replace(',', '')}, ${clock} IST`
}

export function loginEmail(username: string): string {
  return `${username.trim().toLowerCase()}@zipit.local`
}

export function initials(name: string): string {
  const withoutTags = name.trim().replace(/^(?:\[[^\]]*\]\s*)+/, '')
  const parts = withoutTags
    .split(/\s+/)
    .map((part) => part.replace(/[^0-9A-Za-z]/g, ''))
    .filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0]![0]!.toUpperCase()
  return `${parts[0]![0]!}${parts[1]![0]!}`.toUpperCase()
}

export function friendlyDbError(error: { code?: string; message?: string } | null): string | null {
  if (!error) return null
  const message = error.message ?? ''
  if (message.startsWith('queue_full') || error.code === 'P0001') {
    return 'The scoring queue is full. Try again in a minute.'
  }
  if (error.code === '23514') return "Couldn't save the avatar. Try again."
  if (error.code === '42501') return "That upload wasn't accepted. Try again."
  return null
}

export const ADMIN_SUBMIT_MESSAGE = "Admin accounts can't submit. Sign in with a team account to upload."

/** Storage API errors carry no Postgres code, only a message and an HTTP status. Never show the raw text. */
export function friendlyStorageError(error: { message?: string; statusCode?: string | number } | null): string | null {
  if (!error) return null
  const message = error.message ?? ''
  if (/row-level security|unauthori[sz]ed|403/i.test(message) || String(error.statusCode) === '403') {
    return "That upload wasn't accepted. Try again."
  }
  if (/mime type|not supported/i.test(message)) {
    return 'Only .py files can be uploaded. Rename the file so it ends in lowercase .py.'
  }
  if (/maximum allowed size|too large|payload/i.test(message)) {
    return 'That file is over 256 KB. Upload a smaller .py file.'
  }
  return null
}
