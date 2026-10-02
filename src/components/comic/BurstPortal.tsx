import { useEffect, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Sfx } from '@/components/comic/Sfx'

/** Full-viewport stamp. Portaled so a transformed ancestor cannot trap it. */
export function StampOverlay({ children }: { children: ReactNode }) {
  if (typeof document === 'undefined') return null
  return createPortal(<div className="zi-burst-layer">{children}</div>, document.body)
}

type Pop = { id: number; x: number; y: number; reduced: boolean }

/** CLICK! at the pointer for every button and link. Does not call preventDefault. */
export function ClickBurst() {
  const [pops, setPops] = useState<Pop[]>([])
  useEffect(() => {
    let seq = 0
    const onClick = (event: MouseEvent) => {
      if (event.button !== 0) return
      const target = event.target
      if (!(target instanceof Element)) return
      if (!target.closest('a, button, [role="button"], label.zi-abtn')) return
      const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      const id = ++seq
      setPops((list) => [...list.slice(-8), { id, x: event.clientX, y: event.clientY, reduced }])
      window.setTimeout(() => {
        setPops((list) => list.filter((item) => item.id !== id))
      }, reduced ? 320 : 980)
    }
    document.addEventListener('click', onClick)
    return () => document.removeEventListener('click', onClick)
  }, [])
  if (typeof document === 'undefined' || pops.length === 0) return null
  return createPortal(
    <div className="zi-fx" aria-hidden>
      {pops.map((pop) => (
        <span key={pop.id} className="zi-click-at" style={{ left: pop.x, top: pop.y }}>
          <Sfx preset="click" stamp={false} play={!pop.reduced} holdMs={420} />
        </span>
      ))}
    </div>,
    document.body,
  )
}
