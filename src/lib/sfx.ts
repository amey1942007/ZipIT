/** Quiet UI sounds. Created on the first burst, never before a user action. */

const VOLUME = { click: 0.5, zipped: 0.35 } as const

export type SfxName = keyof typeof VOLUME

let armed = false
let format: 'ogg' | 'mp3' = 'mp3'
const clips: Partial<Record<SfxName, HTMLAudioElement>> = {}

function pickFormat(): 'ogg' | 'mp3' {
  const probe = document.createElement('audio')
  const ogg = probe.canPlayType('audio/ogg; codecs="vorbis"') || probe.canPlayType('audio/ogg')
  return ogg ? 'ogg' : 'mp3'
}

function asset(name: SfxName): string {
  const base = import.meta.env.BASE_URL || '/'
  const root = base.endsWith('/') ? base : `${base}/`
  return `${root}sfx/${name}.${format}`
}

function arm() {
  if (armed || typeof Audio === 'undefined') return
  armed = true
  format = pickFormat()
  for (const name of Object.keys(VOLUME) as SfxName[]) {
    const audio = new Audio()
    audio.preload = 'auto'
    audio.src = asset(name)
    audio.volume = VOLUME[name]
    clips[name] = audio
  }
}

function retrigger(audio: HTMLAudioElement, volume: number) {
  try {
    audio.pause()
    audio.currentTime = 0
  } catch {
    const clone = audio.cloneNode(true) as HTMLAudioElement
    clone.volume = volume
    void clone.play()?.catch(() => {})
    return
  }
  void audio.play()?.catch(() => {})
}

export function playSfx(name: SfxName) {
  if (typeof document === 'undefined') return
  arm()
  const audio = clips[name]
  if (!audio) return
  retrigger(audio, VOLUME[name])
}

export function playClick() {
  playSfx('click')
}

export function playZipped() {
  playSfx('zipped')
}
