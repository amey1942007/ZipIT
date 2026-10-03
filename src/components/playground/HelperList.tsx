import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { HELPER_DOCS, type HelperDoc } from '@/playground/reference'

const HIDE_DELAY_MS = 160
const POPOVER_WIDTH = 560
const GAP = 16

function wideScreen(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(min-width: 1024px)').matches
}

/** Fixed position beside the trigger, clamped to the viewport. Panels clip overflow, so wide screens portal out. */
function placeBeside(trigger: HTMLElement): CSSProperties {
  const rect = trigger.getBoundingClientRect()
  const width = Math.min(POPOVER_WIDTH, window.innerWidth - 2 * GAP)
  const left = Math.min(rect.right + GAP, window.innerWidth - width - GAP)
  const top = Math.max(GAP, Math.min(rect.top - 12, window.innerHeight - 360))
  return { position: 'fixed', left, top, width, maxHeight: window.innerHeight - top - GAP }
}

function HelperCard({ doc, id, style, onEnter, onLeave }: {
  doc: HelperDoc
  id: string
  style?: CSSProperties
  onEnter?: () => void
  onLeave?: () => void
}) {
  return (
    <div
      id={id}
      role="region"
      aria-label={`${doc.name} helper`}
      style={style}
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      className="z-50 grid gap-3 overflow-auto rounded border-[3px] border-gold bg-ink p-4 font-sans text-sm font-normal text-ivory shadow-[6px_6px_0_var(--color-comic-red)]"
    >
      <p className="font-mono text-[15px] font-bold text-gold">{doc.signature}</p>
      <p>{doc.summary}</p>
      <ul className="grid gap-1 text-ivory-muted">
        {doc.details.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
      <div className="grid gap-1">
        <p className="font-display text-[12px] font-semibold tracking-[0.12em] text-gold uppercase">On the 4×4 example</p>
        {doc.examples.map((example) => (
          <div key={example.expr}>
            <code className="font-mono text-[13px]">
              <span className="text-gold">{example.expr}</span> <span className="text-ivory/60">→</span> {example.value}
            </code>
            {example.note ? <p className="text-[13px] text-ivory-muted">{example.note}</p> : null}
          </div>
        ))}
      </div>
      <p className="text-[13px]">
        <span className="font-display text-[12px] font-semibold tracking-[0.12em] text-gold uppercase">Cost · </span>
        {doc.cost}
      </p>
      <div className="grid gap-1">
        <p className="font-display text-[12px] font-semibold tracking-[0.12em] text-gold uppercase">Source · helpers/primitives.py</p>
        <pre className="overflow-x-auto rounded border-2 border-[rgba(255,200,61,.4)] bg-black/30 p-3 font-mono text-[12px] leading-relaxed text-ivory/90">
          {doc.source}
        </pre>
      </div>
    </div>
  )
}

export function HelperList() {
  const [open, setOpen] = useState<string | null>(null)
  const [style, setStyle] = useState<CSSProperties | null>(null)
  const triggers = useRef(new Map<string, HTMLButtonElement>())
  const hideTimer = useRef<number | undefined>(undefined)
  const cardHovered = useRef(false)

  function cancelHide() {
    window.clearTimeout(hideTimer.current)
  }

  function enterCard() {
    cardHovered.current = true
    cancelHide()
  }

  function leaveCard() {
    cardHovered.current = false
    hideSoon()
  }

  function show(name: string) {
    cancelHide()
    cardHovered.current = false
    const trigger = triggers.current.get(name)
    setStyle(trigger && wideScreen() ? placeBeside(trigger) : null)
    setOpen(name)
  }

  function hideSoon() {
    cancelHide()
    hideTimer.current = window.setTimeout(() => {
      if (!cardHovered.current) setOpen(null)
    }, HIDE_DELAY_MS)
  }

  useEffect(() => {
    if (!open || !style) return
    const reposition = () => {
      const trigger = triggers.current.get(open)
      if (trigger) setStyle(placeBeside(trigger))
    }
    window.addEventListener('scroll', reposition, true)
    window.addEventListener('resize', reposition)
    return () => {
      window.removeEventListener('scroll', reposition, true)
      window.removeEventListener('resize', reposition)
    }
  }, [open, style])

  useEffect(() => () => window.clearTimeout(hideTimer.current), [])

  return (
    <ul className="grid gap-0.5 font-mono text-[13px] font-bold">
      {HELPER_DOCS.map((doc) => {
        const id = `helper-doc-${doc.name}`
        const isOpen = open === doc.name
        return (
          <li key={doc.name} onMouseEnter={() => show(doc.name)} onMouseLeave={hideSoon}>
            <button
              ref={(node) => {
                if (node) triggers.current.set(doc.name, node)
                else triggers.current.delete(doc.name)
              }}
              type="button"
              aria-expanded={isOpen}
              aria-controls={isOpen ? id : undefined}
              className="text-left underline decoration-dotted decoration-2 underline-offset-4 hover:text-comic-red focus-visible:text-comic-red"
              onClick={() => show(doc.name)}
              onFocus={() => show(doc.name)}
              onBlur={hideSoon}
              onKeyDown={(event) => {
                if (event.key === 'Escape') setOpen(null)
              }}
            >
              {doc.signature}
            </button>
            {isOpen && style
              ? createPortal(<HelperCard doc={doc} id={id} style={style} onEnter={enterCard} onLeave={leaveCard} />, document.body)
              : null}
            {isOpen && !style ? (
              <div className="mt-2">
                <HelperCard doc={doc} id={id} onEnter={enterCard} onLeave={leaveCard} />
              </div>
            ) : null}
          </li>
        )
      })}
    </ul>
  )
}
