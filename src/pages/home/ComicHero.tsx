import { useEffect, useRef, useState } from 'react'
import { useReducedMotion } from 'motion/react'
import { EVENT_DATE, ORGANISER_LINE, ORGANISER_SUBLINE, TAGLINE } from '@/config/site'
import { ActionButton } from '@/components/comic/ActionButton'
import { Badge } from '@/components/comic/Badge'
import { Balloon } from '@/components/comic/Balloon'
import { CaptionBox } from '@/components/comic/CaptionBox'
import { GutterPath } from '@/components/comic/GutterPath'
import { HudReadout } from '@/components/comic/HudReadout'
import { Panel } from '@/components/comic/Panel'
import { PathMeter } from '@/components/comic/PathMeter'
import { StampOverlay } from '@/components/comic/BurstPortal'
import { Sfx } from '@/components/comic/Sfx'
import { TeamStatsPanel } from '@/components/comic/TeamStatsPanel'
import { CodePlaygroundButton } from '@/components/shell/Shell'
import { useAuth } from '@/lib/auth'
import { badgeAnchors, desktopRoute, distanceAlong, mobileRoute, pathLength, pointsToD, tabletRoute, type Point, type Rect } from '@/lib/gutterRoute'
import { INTRO_END, nodeElapsed, pathProgress, reachTime } from '@/pages/home/heroTimeline'

const INTRO_KEY = 'zi-hero-intro-v4'

function skipIntro(): boolean {
  if (typeof window === 'undefined') return true
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return true
  if (document.visibilityState === 'hidden') return true
  try {
    return sessionStorage.getItem(INTRO_KEY) === '1'
  } catch {
    return true
  }
}

function markIntro() {
  try {
    sessionStorage.setItem(INTRO_KEY, '1')
  } catch {
    /* private mode */
  }
}

export function ComicHero() {
  const reduced = useReducedMotion()
  const { session } = useAuth()
  const gridRef = useRef<HTMLDivElement>(null)
  const [t, setT] = useState(() => (skipIntro() ? INTRO_END : 0))
  const [d, setD] = useState('')
  const [badges, setBadges] = useState<Point[]>([])
  const [fractions, setFractions] = useState<number[]>([])
  const playing = t < INTRO_END && !reduced

  useEffect(() => {
    if (!playing) return
    markIntro()
    let start = 0
    let frame = 0
    const step = (now: number) => {
      if (!start) start = now
      const next = Math.min(INTRO_END, (now - start) / 1000)
      setT(next)
      if (next < INTRO_END && document.visibilityState !== 'hidden') frame = requestAnimationFrame(step)
      else setT(INTRO_END)
    }
    frame = requestAnimationFrame(step)
    const onHide = () => {
      if (document.visibilityState === 'hidden') setT(INTRO_END)
    }
    document.addEventListener('visibilitychange', onHide)
    return () => {
      cancelAnimationFrame(frame)
      document.removeEventListener('visibilitychange', onHide)
    }
  }, [playing])

  useEffect(() => {
    const root = gridRef.current
    if (!root) return
    const measure = () => {
      const base = root.getBoundingClientRect()
      const panels: Record<string, Rect> = {}
      root.querySelectorAll<HTMLElement>('[data-panel]').forEach((el) => {
        const area = getComputedStyle(el).gridArea.split('/')[0]?.trim()
        if (!area || area === 'auto') return
        const box = el.getBoundingClientRect()
        panels[area] = { x: box.left - base.left, y: box.top - base.top, w: box.width, h: box.height }
      })
      if (!panels.p1 || !panels.p2 || !panels.p3 || !panels.p4 || !panels.p5 || !panels.p6 || !panels.p7) return
      const width = base.width
      const points = width < 640 ? mobileRoute(panels) : width < 1024 ? tabletRoute(panels) : desktopRoute(panels)
      const anchors = badgeAnchors(points, panels, width)
      const length = pathLength(points) || 1
      setD(pointsToD(points))
      setBadges(anchors)
      setFractions(anchors.map((point) => distanceAlong(points, point) / length))
    }
    measure()
    if (typeof ResizeObserver === 'undefined') return
    let lastWidth = root.clientWidth
    const observer = new ResizeObserver(() => {
      if (root.clientWidth !== lastWidth) setT(INTRO_END)
      lastWidth = root.clientWidth
      measure()
    })
    observer.observe(root)
    return () => observer.disconnect()
  }, [])

  const progress = playing ? pathProgress(t) : 1
  const arenaTo = session ? '/arena' : '/login?next=%2Farena'
  const uploadTo = session ? '/submissions' : '/login?next=%2Fsubmissions'
  const filled = fractions.filter((fraction) => progress + 1e-6 >= fraction).length
  const lit = (index: number) => !playing || (fractions[index] != null && progress + 1e-6 >= fractions[index]!)

  return (
    <section className={playing && t >= 2.02 && t < 2.4 ? 'zi-hero zi-shake' : 'zi-hero'} onKeyDown={(event) => { if (event.key === 'Escape' && playing) setT(INTRO_END) }}>
      <div className={playing ? 'zi-hero-strip zi-hud-drop' : 'zi-hero-strip'}>
        <span className="zi-tm max-lg:hidden">{ORGANISER_LINE}</span>
        <PathMeter
          filled={Math.min(7, filled)}
          readout={playing ? `0${Math.min(filled, 7)}/07 · ${Math.max(0, t - 0.62).toFixed(2)}s` : '07/07 · 1.38s'}
        />
        {playing ? (
          <button type="button" className="zi-tm min-h-11" onClick={() => setT(INTRO_END)}>
            Skip intro
          </button>
        ) : null}
      </div>
      <div ref={gridRef} className={playing ? 'zi-hero-grid zi-intro' : 'zi-hero-grid'}>
        <GutterPath d={d} progress={progress} bolt />
        {playing && t >= 2.02 ? (
          <StampOverlay>
            <Sfx preset="zipit" stamp={false} play holdMs={830} label="ZIP IT!" />
          </StampOverlay>
        ) : null}
        <div data-panel className="zi-slot-path">
          <Panel fill="red" ghost="1" inked={lit(0)} className="h-full">
            <div className="grid h-full content-center p-4">
              <HudReadout>{EVENT_DATE}</HudReadout>
              <p className="comic-word text-[clamp(40px,34cqh,104px)] text-ivory">
                ONE
                <br />
                PATH.
              </p>
            </div>
          </Panel>
        </div>
        <div data-panel className="zi-slot-order">
          <Panel fill="gold" ghost="2" inked={lit(1)} className="h-full">
            <div className="grid h-full content-center p-4">
              <p className="comic-word text-[clamp(48px,46cqh,120px)] text-ink">1→N</p>
              <HudReadout>VISIT IN ORDER</HudReadout>
            </div>
          </Panel>
        </div>
        <div data-panel className="zi-slot-code">
          <Panel fill="ivory-red" ghost="3" inked={lit(2)} className="h-full">
            <div className="grid h-full content-center gap-3 p-4">
              <HudReadout>YOUR HEURISTIC</HudReadout>
              <Balloon>
                <pre className="font-mono text-[15px] leading-relaxed text-ink">{`def next_move(grid, path, cost_map):\n    # return the next (r, c)\n    return best`}</pre>
              </Balloon>
            </div>
          </Panel>
        </div>
        <div data-panel className="zi-slot-stats">
          <Panel fill="maroon" ghost="4" inked={lit(3)} className="h-full">
            <TeamStatsPanel introDone={!playing} />
          </Panel>
        </div>
        <div data-panel className="zi-slot-cta">
          <Panel fill="gold" ghost="5" inked={lit(4)} className="h-full">
            <div className="grid h-full content-center gap-3 p-4">
              <HudReadout>TARGET 05</HudReadout>
              <ActionButton to={arenaTo} size="hero" onClick={() => setT(INTRO_END)}>
                Enter the Arena
              </ActionButton>
            </div>
          </Panel>
        </div>
        <div data-panel className="zi-slot-every">
          <Panel fill="ivory" ghost="6" inked={lit(5)} className="h-full">
            <p className="comic-word p-4 text-[clamp(36px,32cqh,80px)] text-ink">
              EVERY
              <br />
              <span className="text-comic-red">CELL.</span>
            </p>
          </Panel>
        </div>
        <div data-panel className="zi-slot-headline">
          <Panel fill="red" inked={lit(6)} className="h-full">
            <div className="relative grid h-full content-center gap-3 p-4 text-ivory">
              <CaptionBox>
                <h1 tabIndex={-1}>
                  <span className="sr-only">ZipIT. </span>Zip it.
                  <br />
                  <span className="text-comic-red">Fastest path wins.</span>
                </h1>
              </CaptionBox>
              <p>Write one Python function. We race it across every cell of the grid.</p>
              <p>{TAGLINE}</p>
              <div className="flex flex-wrap gap-2">
                <ActionButton to={uploadTo}>Upload a heuristic</ActionButton>
                <ActionButton to="/leaderboard" variant="ghost">
                  Leaderboard
                </ActionButton>
                <CodePlaygroundButton />
              </div>
              <p className="font-display text-xs font-semibold text-gold">
                {ORGANISER_LINE}
                <span className="mt-1 block font-sans text-[13px] font-normal text-ivory-muted">{ORGANISER_SUBLINE}</span>
              </p>
            </div>
          </Panel>
        </div>
        {badges.map((point, index) => (
          <span key={index} className="pointer-events-none absolute z-10" style={{ left: point.x, top: point.y, transform: 'translate(-50%, -50%)' }}>
            <Badge n={index + 1} reached={!playing || progress >= (fractions[index] ?? 1)} className={playing ? 'zi-badge-pop' : undefined} />
            {!playing ? <span className="sr-only">{`NODE 0${index + 1} · ${nodeElapsed(reachTime(fractions[index] ?? 0))}s`}</span> : null}
          </span>
        ))}
      </div>
    </section>
  )
}
