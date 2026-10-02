import { useReducedMotion } from 'motion/react'
import { useCallback, type RefObject } from 'react'

/** 30 samples of x = amp·sin(90t)·(1−t/T), y = amp·cos(77t)·(1−t/T). */
export function shakeSamples(amp: number, ms: number, samples = 30) {
  const duration = ms / 1000
  return Array.from({ length: samples }, (_, index) => {
    const t = samples === 1 ? 0 : (index / (samples - 1)) * duration
    const decay = 1 - t / duration
    return {
      x: amp * Math.sin(90 * t) * decay,
      y: amp * Math.cos(77 * t) * decay,
    }
  })
}

export function useShake(ref: RefObject<HTMLElement | null>) {
  const reduced = useReducedMotion()
  return useCallback(
    ({ amp, ms }: { amp: number; ms: number }) => {
      const node = ref.current
      if (!node || reduced) return
      const frames = shakeSamples(amp, ms).map(({ x, y }) => ({ transform: `translate(${x}px, ${y}px)` }))
      node.animate(frames, { duration: ms, easing: 'linear' })
    },
    [reduced, ref],
  )
}
