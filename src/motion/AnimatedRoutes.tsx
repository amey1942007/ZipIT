import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, usePresence } from 'motion/react'
import { useLocation, useNavigationType } from 'react-router'
import { CurlOverlay } from '@/motion/CurlOverlay'
import { scanEase } from '@/pages/home/heroTimeline'
import { curlPolygons, dMax, polygonCss, syncTransition, transitionBus, type TurnKind } from '@/motion/pageTurn'

/** Outgoing layer must be gone even when onfinish / rAF never runs. */
const EXIT_FAILSAFE_MS = 900
const TURN_MS = 860

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

function immediateExit(kind: TurnKind, el: HTMLElement): boolean {
  return prefersReducedMotion() || kind === 'cut' || kind === 'none' || typeof el.animate !== 'function'
}

function PageLayer({ children, push }: { children: ReactNode; push: boolean }) {
  const [isPresent, safeToRemove] = usePresence()
  const ref = useRef<HTMLDivElement>(null)
  const removeRef = useRef(safeToRemove)
  removeRef.current = safeToRemove
  const [curl, setCurl] = useState<{ c: number; width: number; height: number } | null>(null)
  const finishRef = useRef<(() => void) | null>(null)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el || !isPresent) return
    if (push) window.scrollTo(0, 0)
    el.querySelector<HTMLElement>('#main h1')?.focus()
    const kind = transitionBus.kind
    if (immediateExit(kind, el)) return
    if (kind === 'fade') {
      el.animate([{ opacity: 0, transform: 'translateY(8px)' }, { opacity: 1, transform: 'none' }], { duration: 200, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' })
    } else if (kind === 'slide') {
      el.animate([{ transform: 'translateX(24%)' }, { transform: 'none' }], { duration: 360, easing: 'cubic-bezier(0.2, 0, 0, 1)' })
    }
  }, [isPresent, push])

  useLayoutEffect(() => {
    const el = ref.current
    if (!el || isPresent) return
    const kind = transitionBus.kind
    // Redirects, reduced motion, and cuts must not cover the next page.
    // safeToRemove() cannot run in this layout effect: it fires before
    // AnimatePresence records the exiting key, and that call is ignored.
    if (immediateExit(kind, el)) {
      el.style.display = 'none'
      el.style.pointerEvents = 'none'
      return
    }

    el.inert = true
    el.setAttribute('aria-hidden', 'true')
    el.style.pointerEvents = 'none'
    el.style.position = 'fixed'
    el.style.inset = '0'
    el.style.top = `${-window.scrollY}px`
    el.style.zIndex = '50'
    let stopped = false
    const finish = () => {
      if (stopped) return
      stopped = true
      if (transitionBus.active?.complete === finish) transitionBus.active = null
      setCurl(null)
      removeRef.current?.()
    }
    finishRef.current = finish
    transitionBus.active = { complete: finish }
    let animation: Animation | null = null
    if (kind === 'fade') {
      animation = el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 120, easing: 'cubic-bezier(0.4, 0, 1, 1)' })
      animation.onfinish = finish
      animation.oncancel = finish
    } else if (kind === 'slide') {
      animation = el.animate(
        [{ transform: 'none', opacity: 1 }, { transform: 'translateX(-24%)', opacity: 0 }],
        { duration: 320, easing: 'cubic-bezier(0.4, 0, 1, 1)' },
      )
      animation.onfinish = finish
      animation.oncancel = finish
    } else {
      const width = window.innerWidth || 1280
      const height = window.innerHeight || 720
      const start = dMax(width, height) + 2
      const started = performance.now()
      const tick = (now: number) => {
        if (stopped) return
        const p = Math.min(1, (now - started) / TURN_MS)
        const c = start + (-60 - start) * scanEase(p)
        const { keep } = curlPolygons(width, height, c)
        el.style.clipPath = polygonCss(keep)
        setCurl({ c, width, height })
        if (p < 1) requestAnimationFrame(tick)
        else finish()
      }
      requestAnimationFrame(tick)
    }
    return () => {
      stopped = true
      finishRef.current = null
      animation?.cancel()
    }
  }, [isPresent, push])

  useEffect(() => {
    if (isPresent) return
    const el = ref.current
    const kind = transitionBus.kind
    const immediate = !el || immediateExit(kind, el)
    const drop = () => {
      if (!ref.current?.isConnected) return
      finishRef.current?.()
      if (ref.current?.isConnected) removeRef.current?.()
    }
    if (immediate) drop()
    const failsafe = window.setTimeout(drop, EXIT_FAILSAFE_MS)
    return () => window.clearTimeout(failsafe)
  }, [isPresent, push])

  return (
    <>
      <div ref={ref}>{children}</div>
      {curl && typeof document !== 'undefined'
        ? createPortal(<CurlOverlay c={curl.c} width={curl.width} height={curl.height} />, document.body)
        : null}
    </>
  )
}

export function AnimatedRoutes({ children }: { children: ReactNode }) {
  const location = useLocation()
  const navType = useNavigationType()
  syncTransition(location.key, location.pathname, navType, location.state)
  return (
    <AnimatePresence mode="sync" initial={false}>
      <PageLayer key={transitionBus.turnKey} push={navType === 'PUSH'}>
        {children}
      </PageLayer>
    </AnimatePresence>
  )
}
