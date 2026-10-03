import { useState, type Ref } from 'react'
import { ZipBoard } from '@/components/arena/ZipBoard'
import { HudReadout } from '@/components/comic/HudReadout'
import { Panel } from '@/components/comic/Panel'
import {
  BOARD_REFERENCE,
  EXAMPLE_PATH,
  EXAMPLE_PUZZLE,
  NODE_REFERENCE,
  RETURN_REFERENCE,
  type RefSection,
} from '@/playground/reference'

const TABS = [
  { id: 'board', label: 'board', sections: BOARD_REFERENCE },
  { id: 'node', label: 'node', sections: NODE_REFERENCE },
  { id: 'returns', label: 'what to return', sections: RETURN_REFERENCE },
] as const

type TabId = (typeof TABS)[number]['id']

const EXAMPLE_CELL = 64

function Sections({ sections }: { sections: readonly RefSection[] }) {
  return (
    <div className="grid gap-4">
      {sections.map((section) => (
        <div key={section.title} className="grid gap-2">
          <HudReadout>{section.title.toUpperCase()}</HudReadout>
          <dl className="grid gap-2">
            {section.entries.map((entry) => (
              <div key={entry.expr} className="grid gap-0.5 border-b border-[rgba(255,246,232,.12)] pb-2">
                <dt className="font-mono text-[13px] font-bold text-gold">{entry.label ?? entry.expr}</dt>
                <dd className="grid gap-0.5">
                  <pre className="font-mono text-[13px] leading-relaxed whitespace-pre-wrap break-words text-ivory">{entry.value}</pre>
                  {entry.note ? <p className="text-[13px] text-ivory-muted">{entry.note}</p> : null}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      ))}
    </div>
  )
}

export function InputsReference({ ref }: { ref?: Ref<HTMLDivElement> }) {
  const [tab, setTab] = useState<TabId>('board')
  const current = TABS.find((item) => item.id === tab) ?? TABS[0]
  return (
    <div ref={ref} className="scroll-mt-24">
      <Panel fill="maroon" className="min-w-0">
        <div className="grid gap-4 p-5 lg:grid-cols-[360fr_840fr]">
          <div className="grid content-start gap-3">
            <HudReadout>WHAT YOUR CODE RECEIVES</HudReadout>
            <p className="text-ivory">
              Every call gets the same two objects: <code className="font-mono text-gold">node</code> (one partial path) and{' '}
              <code className="font-mono text-gold">board</code> (the puzzle). The values here are real engine output for this 4×4 Zip,
              with the path 0 → 1 → 5 drawn.
            </p>
            <div className="mx-auto w-fit">
              <ZipBoard
                puzzle={EXAMPLE_PUZZLE}
                path={EXAMPLE_PATH}
                backtracked={[]}
                head={EXAMPLE_PATH[EXAMPLE_PATH.length - 1] ?? null}
                cell={EXAMPLE_CELL}
                showLine
              />
            </div>
            <p className="font-mono text-[13px] text-ivory-muted">
              Dots 1, 2, 3 are cells 0, 7, 12. The thick edge between cells 5 and 6 is the wall.
            </p>
          </div>
          <div className="grid min-w-0 content-start gap-3">
            <div className="flex flex-wrap gap-2" role="tablist" aria-label="Inputs reference">
              {TABS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  role="tab"
                  aria-selected={tab === item.id}
                  className={tab === item.id ? 'zi-tab zi-tab-active' : 'zi-tab zi-tab-idle'}
                  onClick={() => setTab(item.id)}
                >
                  {item.label}
                </button>
              ))}
            </div>
            <div role="tabpanel" aria-label={current.label} className="rounded border-[3px] border-dashed border-[rgba(255,200,61,.6)] bg-ink p-4">
              <Sections sections={current.sections} />
            </div>
          </div>
        </div>
      </Panel>
    </div>
  )
}
