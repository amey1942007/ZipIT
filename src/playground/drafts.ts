import { TEMPLATES, type PlaygroundFile } from '@/playground/templates'

const KEY = 'zipit.playground-drafts.v1'
const MAX_CHARS = 262_144

export type Drafts = Record<PlaygroundFile, string>

export function templateDrafts(): Drafts {
  return { ...TEMPLATES }
}

export function loadDrafts(): Drafts {
  const drafts = templateDrafts()
  try {
    const raw = window.localStorage.getItem(KEY)
    if (!raw) return drafts
    const saved = JSON.parse(raw) as Partial<Record<string, unknown>>
    for (const file of Object.keys(drafts) as PlaygroundFile[]) {
      const text = saved[file]
      if (typeof text === 'string' && text.length <= MAX_CHARS) drafts[file] = text
    }
  } catch {
    return drafts
  }
  return drafts
}

/** Returns false when storage is full or blocked; the editor keeps working either way. */
export function saveDrafts(drafts: Drafts): boolean {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(drafts))
    return true
  } catch {
    return false
  }
}

export function downloadDraft(name: string, text: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/x-python' }))
  const link = document.createElement('a')
  link.href = url
  link.download = name
  document.body.append(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}
