import { lazy, Suspense, useEffect, useMemo, useRef, useState, type ComponentType } from 'react'
import { useNavigate } from 'react-router'
import {
  CHECK_LABELS,
  CHECK_ORDER,
  checksPassed,
  EngineClient,
  formatElapsed,
  pathSteps,
  STATUS_LABELS,
  type CheckResult,
  type EngineResult,
} from '@/arena/engine'
import { frameAt } from '@/arena/playback'
import { useCellSize } from '@/components/arena/useCellSize'
import { ZipBoard } from '@/components/arena/ZipBoard'
import { ActionButton } from '@/components/comic/ActionButton'
import { Balloon } from '@/components/comic/Balloon'
import { CaptionBox } from '@/components/comic/CaptionBox'
import { CheckChip } from '@/components/comic/CheckChip'
import { HudReadout } from '@/components/comic/HudReadout'
import { Panel } from '@/components/comic/Panel'
import { PageFrame } from '@/components/PageFrame'
import type { CodeEditorProps } from '@/components/playground/CodeEditor'
import { DEFAULT_GRID } from '@/config/site'
import { downloadDraft, loadDrafts, saveDrafts, templateDrafts, type Drafts } from '@/playground/drafts'
import { isUnchanged, PLAYGROUND_FILES, type PlaygroundFile } from '@/playground/templates'
import { stageSubmission } from '@/lib/stagedSubmission'
import { SEARCH_FILE, TIEBREAKER_FILE } from '@/lib/uploadChecks'
import { generatePuzzle, type GeneratedPuzzle } from '@/lib/zip/generate'

const CodeEditor = lazy(() => import('@/components/playground/CodeEditor')) as unknown as ComponentType<
  CodeEditorProps<PlaygroundFile>
>

const AUTOSAVE_MS = 600

const HELPERS = [
  'manhattan(board, a, b)',
  'bfs_distance(board, src, dst, node)',
  'next_checkpoint(node, board)',
  'next_manhattan(node, board)',
  'unvisited_neighbors(node, board)',
  'free_degree(node, board)',
  'unvisited_component_size(node, board)',
  'trapped_unvisited(node, board)',
]

function chipState(id: (typeof CHECK_ORDER)[number], checks: CheckResult[] | null): 'idle' | 'ok' | 'bad' {
  const found = checks?.find((item) => item.id === id)
  if (!found) return 'idle'
  return found.ok ? 'ok' : 'bad'
}

export function PlaygroundPage() {
  const navigate = useNavigate()
  const [drafts, setDrafts] = useState<Drafts>(() => loadDrafts())
  const [file, setFile] = useState<PlaygroundFile>(SEARCH_FILE)
  const [resetKey, setResetKey] = useState(0)
  const [saved, setSaved] = useState(true)
  const [checks, setChecks] = useState<CheckResult[] | null>(null)
  const [result, setResult] = useState<EngineResult | null>(null)
  const [puzzle, setPuzzle] = useState<GeneratedPuzzle | null>(null)
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState('')
  const [boardSlot, setBoardSlot] = useState<HTMLDivElement | null>(null)
  const engine = useRef<EngineClient | null>(null)
  const draftsRef = useRef(drafts)
  const cell = useCellSize(puzzle?.cols ?? DEFAULT_GRID, boardSlot)

  useEffect(() => {
    const client = new EngineClient()
    engine.current = client
    return () => client.dispose()
  }, [])

  useEffect(() => {
    if (saved) return
    const timer = window.setTimeout(() => setSaved(saveDrafts(draftsRef.current)), AUTOSAVE_MS)
    return () => window.clearTimeout(timer)
  }, [drafts, saved])

  const frame = useMemo(() => {
    if (!puzzle || !result) return null
    const steps = pathSteps(result.path, puzzle.cols)
    return frameAt({ ...puzzle, seed: 0 }, steps, steps.length)
  }, [puzzle, result])

  function edit(target: PlaygroundFile, text: string) {
    draftsRef.current = { ...draftsRef.current, [target]: text }
    setDrafts(draftsRef.current)
    setSaved(false)
  }

  function saveNow() {
    setSaved(saveDrafts(draftsRef.current))
  }

  function reset() {
    if (!window.confirm('Replace both files with the starter template? Your current code will be lost.')) return
    const fresh = templateDrafts()
    draftsRef.current = fresh
    setDrafts(fresh)
    setResetKey((value) => value + 1)
    setSaved(saveDrafts(fresh))
    setChecks(null)
    setResult(null)
    setPuzzle(null)
    setNote('')
  }

  async function checkAndRun() {
    const client = engine.current
    if (!client || busy) return
    let generated: GeneratedPuzzle
    try {
      generated = generatePuzzle({ seed: Date.now() >>> 0, rows: DEFAULT_GRID, cols: DEFAULT_GRID, timeBudgetMs: 2500 })
    } catch (error) {
      setNote(error instanceof Error ? error.message : 'Could not generate a Zip.')
      return
    }
    setBusy(true)
    setChecks(null)
    setResult(null)
    setPuzzle(generated)
    setNote('Starting Python and checking your code…')
    const code = { search: draftsRef.current[SEARCH_FILE], tiebreaker: draftsRef.current[TIEBREAKER_FILE] }
    const reply = await client.run(code, generated)
    setBusy(false)
    if (reply.checks.length) setChecks(reply.checks)
    if (reply.error) {
      setNote(reply.error)
      return
    }
    if (!reply.result) {
      setNote('Fix the failed check, then run again.')
      return
    }
    setResult(reply.result)
    setNote(reply.result.solved ? '' : 'Showing the deepest path the search reached.')
  }

  function download() {
    for (const name of PLAYGROUND_FILES) downloadDraft(name, draftsRef.current[name])
  }

  async function submit() {
    const client = engine.current
    if (!client || busy) return
    saveNow()
    const code = { search: draftsRef.current[SEARCH_FILE], tiebreaker: draftsRef.current[TIEBREAKER_FILE] }
    const untouched = PLAYGROUND_FILES.filter((name) => isUnchanged(name, draftsRef.current[name]))
    if (untouched.length) {
      setNote(`Write your own code first: ${untouched.join(' and ')} ${untouched.length > 1 ? 'are' : 'is'} still the starter template.`)
      return
    }
    setBusy(true)
    setNote('Checking your code before submitting…')
    const reply = await client.check(code)
    setBusy(false)
    setChecks(reply.checks.length ? reply.checks : null)
    if (reply.error) {
      setNote(reply.error)
      return
    }
    if (!checksPassed(reply.checks)) {
      setNote('Fix the failed check before submitting.')
      return
    }
    setNote('')
    stageSubmission(code.search, code.tiebreaker)
    navigate('/submissions')
  }

  const failed = checks?.find((item) => !item.ok) ?? null
  const stats = result?.stats ?? {}

  return (
    <PageFrame title="Code Playground">
      <div className="grid gap-4 lg:grid-cols-[360fr_840fr]">
        <Panel fill="ivory" className="zi-enter-l">
          <div className="grid gap-4 p-5 text-ink">
            <HudReadout>PLAYGROUND · PANEL 1/2</HudReadout>
            <ul className="grid gap-1 bg-ivory text-[15px] font-medium">
              <li>search.py: class Score with score(self, node, board). Higher scores expand first.</li>
              <li>tiebreaker.py: class TieBreaker with key(self, node, board). The greater key wins a tie.</li>
              <li>Imports: helpers and the Python standard library only.</li>
              <li>Limits: 200,000 expansions or 20 s per board.</li>
            </ul>
            <div className="grid gap-2">
              <HudReadout>HELPERS</HudReadout>
              <ul className="grid gap-0.5 font-mono text-[13px] font-bold">
                {HELPERS.map((name) => (
                  <li key={name}>{name}</li>
                ))}
              </ul>
            </div>
            <div className="grid gap-2">
              <HudReadout>CHECKS</HudReadout>
              <div className="flex flex-wrap gap-2">
                {CHECK_ORDER.map((id, i) => (
                  <CheckChip key={id} label={CHECK_LABELS[id]} state={chipState(id, checks)} delay={i * 120} />
                ))}
              </div>
              {failed ? <p className="bg-comic-red px-2 py-1 font-mono text-sm text-ivory">{failed.message}</p> : null}
            </div>
            <Balloon>
              <p>Write your code in the big panel, then Check &amp; run →</p>
            </Balloon>
          </div>
        </Panel>
        <Panel fill="maroon" className="zi-enter-r min-w-0">
          <div className="grid h-full min-w-0 gap-4 p-5">
            <HudReadout>EDITOR · PANEL 2/2</HudReadout>
            <div className="flex flex-wrap items-center gap-2" role="tablist" aria-label="Files">
              {PLAYGROUND_FILES.map((name) => (
                <button
                  key={name}
                  type="button"
                  role="tab"
                  aria-selected={file === name}
                  className={file === name ? 'zi-tab zi-tab-active' : 'zi-tab zi-tab-idle'}
                  onClick={() => setFile(name)}
                >
                  {name}
                </button>
              ))}
              <span className="ml-auto font-mono text-[13px] text-ivory-muted" aria-live="polite">
                {saved ? 'Draft saved' : 'Saving…'}
              </span>
            </div>
            <div className="zi-codebox rounded border-[3px] border-dashed border-[rgba(255,200,61,.6)] bg-ink">
              {busy ? <div className="zi-scan" aria-hidden /> : null}
              <Suspense
                fallback={
                  <pre className="h-[min(60svh,560px)] min-h-72 overflow-hidden p-4 font-mono text-sm leading-relaxed text-ivory/80">
                    {drafts[file]}
                  </pre>
                }
              >
                <CodeEditor
                  file={file}
                  docs={drafts}
                  resetKey={resetKey}
                  label={`${file}, editable. Press Escape then Tab to leave the editor.`}
                  onChange={edit}
                  onSave={saveNow}
                />
              </Suspense>
            </div>
            <p className="font-mono text-[13px] text-ivory-muted">
              Tab indents · Ctrl/Cmd+S saves · Esc then Tab leaves the editor · drafts stay in this browser
            </p>
            <div className="flex flex-wrap gap-2">
              <ActionButton type="button" sfx="go" disabled={busy} onClick={() => void checkAndRun()}>
                {busy ? 'Running…' : 'Check & run on a Zip'}
              </ActionButton>
              <ActionButton type="button" variant="ghost" onClick={download}>
                Download
              </ActionButton>
              <ActionButton type="button" variant="ghost" disabled={busy} onClick={() => void submit()}>
                Submit
              </ActionButton>
              <ActionButton type="button" variant="ghost" disabled={busy} onClick={reset}>
                Reset to template
              </ActionButton>
            </div>
            {note ? <p className="text-ivory-muted">{note}</p> : null}
          </div>
        </Panel>
      </div>
      {puzzle && (busy || result) ? (
        <div className="grid gap-4 lg:grid-cols-[360fr_840fr]">
          <Panel fill="plain" className="min-w-0">
            <div className="grid gap-3 p-4">
              <HudReadout>RESULT · {DEFAULT_GRID}×{DEFAULT_GRID} ZIP</HudReadout>
              <div className="grid gap-1 font-mono text-sm font-bold text-text-muted tabular-nums">
                <p>Status: {busy ? 'Running…' : result ? STATUS_LABELS[result.status] : '—'}</p>
                <p>
                  Path: {frame ? frame.path.length : 0}/{puzzle.rows * puzzle.cols} cells
                </p>
                <p>Expansions: {stats.expansions ?? '—'}</p>
                <p>Backtracks: {stats.backtracks ?? '—'}</p>
                <p>Time: {formatElapsed(stats.elapsed)}</p>
              </div>
              {result?.error ? <p className="bg-comic-red px-2 py-1 font-mono text-sm text-ivory">{result.error}</p> : null}
              {result?.solved ? (
                <CaptionBox className="zi-stamp">
                  <p className="font-display text-2xl font-bold">ZIP IT! · solved</p>
                </CaptionBox>
              ) : null}
              <p className="text-sm text-text-muted">Practice only. Official scores come from the scorer.</p>
            </div>
          </Panel>
          <Panel fill="maroon" className="min-w-0 p-4 sm:p-6">
            <div ref={setBoardSlot} className="mx-auto w-full max-w-[560px]">
              {frame ? (
                <ZipBoard
                  puzzle={puzzle}
                  path={frame.path}
                  backtracked={[]}
                  head={frame.head}
                  cell={cell}
                  showLine
                />
              ) : (
                <ZipBoard puzzle={puzzle} path={[]} backtracked={[]} head={null} cell={cell} showLine={false} />
              )}
            </div>
          </Panel>
        </div>
      ) : null}
    </PageFrame>
  )
}
