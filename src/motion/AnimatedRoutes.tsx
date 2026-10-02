import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { AnimatePresence, usePresence } from 'motion/react'
import { useLocation, useNavigationType } from 'react-router'
import { CurlOverlay } from '@/motion/CurlOverlay'
import { scanEase } from '@/pages/home/heroTimeline'
import { curlPolygons, dMax, polygonCss, syncTransition, transitionBus } from '@/motion/pageTurn'

function PageLayer({ children, push }: { children: ReactNode; push: boolean }) {
  const [isPresent, safeToRemove] = usePresence()
  const ref = useRef<HTMLDivElement>(null)
  const removeRef = useRef(safeToRemove)
  removeRef.current = safeToRemove
  const [curl, setCurl] = useState<{ c: number; width: number; height: number } | null>(null)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    if (isPresent) {
      if (push) window.scrollTo(0, 0)
      el.querySelector<HTMLElement>('#main h1')?.focus()
      const kind = transitionBus.kind
      if (typeof el.animate !== 'function') return
      if (kind === 'fade') {
        el.animate([{ opacity: 0, transform: 'translateY(8px)' }, { opacity: 1, transform: 'none' }], { duration: 200, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' })
      } else if (kind === 'slide') {
        el.animate([{ transform: 'translateX(24%)' }, { transform: 'none' }], { duration: 360, easing: 'cubic-bezier(0.2, 0, 0, 1)' })
      }
      return
    }
    const kind = transitionBus.kind
    el.inert = true
    el.setAttribute('aria-hidden', 'true')
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
    if (kind === 'cut' || kind === 'none' || typeof el.animate !== 'function') {
      finish()
      return
    }
    transitionBus.active = { complete: finish }
    if (kind === 'fade') {
      el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 120, easing: 'cubic-bezier(0.4, 0, 1, 1)' }).onfinish = finish
      return
    }
    if (kind === 'slide') {
      el.animate(
        [{ transform: 'none', opacity: 1 }, { transform: 'translateX(-24%)', opacity: 0 }],
        { duration: 320, easing: 'cubic-bezier(0.4, 0, 1, 1)' },
      ).onfinish = finish
      return
    }
    const width = window.innerWidth || 1280
    const height = window.innerHeight || 720
    const start = dMax(width, height) + 2
    const started = performance.now()
    const tick = (now: number) => {
      if (stopped) return
      const p = Math.min(1, (now - started) / 950)
      const c = start + (-60 - start) * scanEase(p)
      const { keep } = curlPolygons(width, height, c)
      el.style.clipPath = polygonCss(keep)
      setCurl({ c, width, height })
      if (p < 1) requestAnimationFrame(tick)
      else finish()
    }
    requestAnimationFrame(tick)
    return () => {
      stopped = true
    }
  }, [isPresent, push])

  return (
    <div ref={ref}>
      {children}
      {curl ? <CurlOverlay c={curl.c} width={curl.width} height={curl.height} /> : null}
    </div>
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
