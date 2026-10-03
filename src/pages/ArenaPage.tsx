import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router'
import {
  CHECK_LABELS,
  CHECK_ORDER,
  checksPassed,
  EngineClient,
  pathSteps,
  STATUS_LABELS,
  type CheckResult,
  type EngineResult,
  type SubmissionCode,
} from '@/arena/engine'
import { frameAt } from '@/arena/playback'
import type { ReplayStep } from '@/arena/replayContract'
import { DEFAULT_GRID, GRID_SIZES, SPEEDS, SPEED_STEPS_PER_S } from '@/config/site'
import { useCellSize } from '@/components/arena/useCellSize'
import { ZipBoard } from '@/components/arena/ZipBoard'
import { ActionButton } from '@/components/comic/ActionButton'
import { CheckChip } from '@/components/comic/CheckChip'
import { HudReadout } from '@/components/comic/HudReadout'
import { Panel } from '@/components/comic/Panel'
import { Sfx } from '@/components/comic/Sfx'
import { PageFrame } from '@/components/PageFrame'
import { useAuth } from '@/lib/auth'
import { downloadSubmissionFiles, fetchSubmissions, type SubmissionRow } from '@/lib/data'
import { formatIst, formatScore } from '@/lib/format'
import { generatePuzzle, type GeneratedPuzzle } from '@/lib/zip/generate'

/** The Arena keeps the current Zip and the one before it. A third New Zip drops the oldest. */
const HISTORY_SIZE = 2

interface ZipEntry {
  key: number
  puzzle: GeneratedPuzzle
  result: EngineResult | null
  steps: ReplayStep[]
}

function chipState(id: (typeof CHECK_ORDER)[number], checks: CheckResult[] | null): 'idle' | 'ok' | 'bad' {
  const found = checks?.find((item) => item.id === id)
  if (!found) return 'idle'
  return found.ok ? 'ok' : 'bad'
}

function submissionLabel(row: SubmissionRow): string {
  const score = row.status === 'scored' ? ` · ${formatScore(row.score)}` : ` · ${row.status}`
  return `${formatIst(row.created_at)}${score}`
}

export function ArenaPage() {
  const { submissionId } = useParams()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const { team, isAdmin } = useAuth()
  const viewedTeam = params.get('team')
  const viewOnly = Boolean(isAdmin && viewedTeam && viewedTeam !== team?.id)
  const teamId = viewedTeam || team?.id || null
  const [rows, setRows] = useState<SubmissionRow[] | null>(null)
  const [code, setCode] = useState<SubmissionCode | null>(null)
  const [checks, setChecks] = useState<CheckResult[] | null>(null)
  const [history, setHistory] = useState<ZipEntry[]>([])
  const [showPrevious, setShowPrevious] = useState(false)
  const [busy, setBusy] = useState(false)
  const [index, setIndex] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState<(typeof SPEEDS)[number]>(1)
  const [grid, setGrid] = useState<number>(DEFAULT_GRID)
  const [note, setNote] = useState('')
  const [boardSlot, setBoardSlot] = useState<HTMLDivElement | null>(null)
  const engine = useRef<EngineClient | null>(null)
  const keyRef = useRef(0)
  const loadRef = useRef(0)
  const gridRef = useRef(grid)

  useEffect(() => {
    gridRef.current = grid
  }, [grid])

  const selected = useMemo(() => {
    if (!rows || rows.length === 0) return null
    return rows.find((row) => row.id === submissionId) ?? (submissionId ? null : rows[0]!)
  }, [rows, submissionId])
  const missing = Boolean(rows && submissionId && !selected)
  const [shownId, setShownId] = useState<string | null>(null)
  if ((selected?.id ?? null) !== shownId) {
    setShownId(selected?.id ?? null)
    setCode(null)
    setChecks(null)
    setHistory([])
    setShowPrevious(false)
    setPlaying(false)
    if (selected) setNote('Loading the submission…')
  }

  const entry = showPrevious && history.length >= 2 ? history[history.length - 2]! : history[history.length - 1] ?? null
  const puzzle = entry?.puzzle ?? null
  const steps = useMemo(() => entry?.steps ?? [], [entry])
  const cell = useCellSize(puzzle?.cols ?? grid, boardSlot)

  useEffect(() => {
    const client = new EngineClient()
    engine.current = client
    return () => client.dispose()
  }, [])

  useEffect(() => {
    if (!teamId) return
    let stop = false
    void fetchSubmissions(teamId)
      .then((list) => {
        if (!stop) setRows(list)
      })
      .catch(() => {
        if (!stop) {
          setRows([])
          setNote('Could not load submissions.')
        }
      })
    return () => {
      stop = true
    }
  }, [teamId])

  const runOn = useCallback(async (source: SubmissionCode, size: number) => {
    const client = engine.current
    if (!client) return
    let generated: GeneratedPuzzle
    try {
      generated = generatePuzzle({ seed: Date.now() >>> 0, rows: size, cols: size, timeBudgetMs: 2500 })
    } catch (error) {
      setNote(error instanceof Error ? error.message : 'Could not generate a Zip.')
      return
    }
    const key = ++keyRef.current
    setHistory((list) => [...list, { key, puzzle: generated, result: null, steps: [] }].slice(-HISTORY_SIZE))
    setShowPrevious(false)
    setIndex(0)
    setPlaying(false)
    setBusy(true)
    setNote('Running your code on this Zip…')
    const reply = await client.run(source, generated)
    setBusy(false)
    if (reply.checks.length) setChecks(reply.checks)
    if (reply.error) {
      setNote(reply.error)
      return
    }
    const result = reply.result
    if (!result) {
      setNote('Fix the failed check before running.')
      return
    }
    const nextSteps = pathSteps(result.path, generated.cols)
    setHistory((list) => list.map((item) => (item.key === key ? { ...item, result, steps: nextSteps } : item)))
    setIndex(0)
    setPlaying(nextSteps.length > 0)
    setNote(result.solved ? '' : 'Showing the deepest path the search reached.')
  }, [])

  useEffect(() => {
    if (!selected) return
    const load = ++loadRef.current
    let stop = false
    void downloadSubmissionFiles(selected)
      .then(async (files) => {
        if (stop || load !== loadRef.current) return
        setCode(files)
        setBusy(true)
        setNote('Starting Python and checking your code…')
        const reply = await engine.current?.check(files)
        if (stop || load !== loadRef.current || !reply) return
        setBusy(false)
        setChecks(reply.checks)
        if (reply.error) {
          setNote(reply.error)
          return
        }
        if (!checksPassed(reply.checks)) {
          setNote('')
          return
        }
        await runOn(files, gridRef.current)
      })
      .catch(() => {
        if (!stop) {
          setBusy(false)
          setNote('Could not download this submission.')
        }
      })
    return () => {
      stop = true
    }
  }, [selected, runOn])

  useEffect(() => {
    if (!playing || steps.length === 0) return
    const timer = window.setInterval(() => {
      setIndex((current) => {
        if (current >= steps.length) {
          setPlaying(false)
          return current
        }
        return current + 1
      })
    }, 1000 / SPEED_STEPS_PER_S[speed])
    return () => window.clearInterval(timer)
  }, [playing, speed, steps.length])

  const frame = useMemo(() => (puzzle ? frameAt(puzzle, steps, index) : null), [puzzle, steps, index])

  function pick(id: string) {
    const query = viewedTeam ? `?team=${encodeURIComponent(viewedTeam)}` : ''
    navigate(`/arena/${id}${query}`)
  }

  function newZip() {
    if (code && checksPassed(checks)) void runOn(code, grid)
  }

  const result = entry?.result ?? null
  const playbackOff = steps.length === 0 || busy
  const solved = Boolean(result?.solved && frame && puzzle && frame.path.length === puzzle.rows * puzzle.cols)
  const failed = checks?.find((item) => !item.ok) ?? null
  const modeLabel = viewOnly ? `VIEW ONLY · ${viewedTeam}` : 'RUN'
  const stats = result?.stats ?? {}
  const total = puzzle ? puzzle.rows * puzzle.cols : 0

  return (
    <PageFrame title="Arena">
      {rows && rows.length === 0 ? (
        <p className="rounded-xl border border-border bg-surface px-4 py-3">
          No submissions yet.{' '}
          <Link to="/submissions" className="font-semibold text-gold">
            Upload search.py and tiebreaker.py
          </Link>{' '}
          to run them here.
        </p>
      ) : null}
      <div className="flex flex-wrap items-center gap-2">
        <HudReadout>{modeLabel}</HudReadout>
        <span className="rounded-full border border-gold px-3 py-1 font-display text-xs font-semibold tracking-[0.12em] text-gold">
          {showPrevious ? 'Previous Zip' : 'Latest Zip'}
        </span>
        {selected ? (
          <span className="rounded-full bg-gold px-3 py-1 font-display text-xs font-semibold tracking-[0.12em] text-on-gold">
            {submissionLabel(selected)}
          </span>
        ) : null}
      </div>
      {note ? <p className="text-text-muted">{note}</p> : null}
      <div className="zi-arena">
        <div className="zi-arena-board">
          {missing ? (
            <p className="text-text-muted">
              Run not found.{' '}
              <Link to="/arena" className="font-semibold text-gold">
                Back to the Arena
              </Link>
            </p>
          ) : puzzle && frame ? (
            <Panel fill="maroon" className="relative p-4 sm:p-6">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <HudReadout>{modeLabel}</HudReadout>
                {Array.from({ length: Math.min(3, frame.waypointsReached) }, (_, i) => (
                  <HudReadout key={i}>{`NODE 0${frame.waypointsReached - i} · STEP ${i}`}</HudReadout>
                ))}
              </div>
              <div ref={setBoardSlot} className="zi-arena-square">
                <ZipBoard
                  puzzle={puzzle}
                  path={frame.path}
                  backtracked={frame.backtracked}
                  head={frame.head}
                  cell={cell}
                  showLine={steps.length > 0}
                  playing={playing}
                />
              </div>
              {solved ? (
                <span className="pointer-events-none absolute top-3 right-3">
                  <Sfx preset="arena" stamp label="ZIP IT!" />
                </span>
              ) : null}
              {solved ? <p className="sr-only">Path complete. Every cell visited.</p> : null}
            </Panel>
          ) : (
            <p className="text-text-muted">
              {rows === null ? 'Loading the board…' : selected ? 'Waiting for the checks…' : 'Pick a submission to run.'}
            </p>
          )}
        </div>
        <Panel fill="plain" className="zi-arena-play min-w-0">
          <div className="grid gap-4 p-4">
            <HudReadout>SUBMISSION</HudReadout>
            {rows && rows.length > 0 ? (
              <label className="grid gap-1 text-sm">
                Run
                <select
                  className="h-11 rounded border-2 border-[rgba(255,246,232,.6)] bg-comic-maroon px-3 text-ivory"
                  value={selected?.id ?? ''}
                  disabled={busy}
                  onChange={(event) => pick(event.target.value)}
                >
                  {rows.map((row) => (
                    <option key={row.id} value={row.id}>
                      {submissionLabel(row)}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            <div className="flex flex-wrap gap-2">
              {CHECK_ORDER.map((id, i) => (
                <CheckChip key={id} label={CHECK_LABELS[id]} state={chipState(id, checks)} delay={i * 120} />
              ))}
            </div>
            {failed ? <p className="bg-comic-red px-2 py-1 font-mono text-sm text-ivory">{failed.message}</p> : null}
            <HudReadout>PLAYBACK</HudReadout>
            <div className="grid gap-1 font-mono text-sm font-bold text-text-muted tabular-nums">
              <p>Status: {busy ? 'Running…' : result ? STATUS_LABELS[result.status] : '—'}</p>
              <p>
                Path: {frame ? frame.path.length : 0}/{total || '—'} cells
              </p>
              <p>Expansions: {stats.expansions ?? '—'}</p>
              <p>Backtracks: {stats.backtracks ?? '—'}</p>
              <p>Time: {typeof stats.elapsed === 'number' ? `${stats.elapsed.toFixed(2)} s` : '—'}</p>
            </div>
            {result?.error ? <p className="bg-comic-red px-2 py-1 font-mono text-sm text-ivory">{result.error}</p> : null}
            <p className="text-sm text-text-muted">Arena runs are practice only. Official scores come from the scorer.</p>
            <div className="flex flex-wrap gap-2">
              <ActionButton type="button" disabled={playbackOff} onClick={() => setPlaying((value) => !value)}>
                {playing ? 'Pause' : 'Play'}
              </ActionButton>
              <ActionButton
                variant="ghost"
                type="button"
                disabled={playbackOff}
                onClick={() => {
                  setPlaying(false)
                  setIndex((value) => Math.max(0, value - 1))
                }}
              >
                Step back
              </ActionButton>
              <ActionButton
                variant="ghost"
                type="button"
                disabled={playbackOff}
                onClick={() => {
                  setPlaying(false)
                  setIndex((value) => Math.min(steps.length, value + 1))
                }}
              >
                Step forward
              </ActionButton>
            </div>
            <label className="grid gap-2 text-sm text-ivory-muted">
              Seek
              <input
                type="range"
                min={0}
                max={Math.max(steps.length, 0)}
                value={Math.min(index, steps.length)}
                disabled={playbackOff}
                onChange={(event) => {
                  setPlaying(false)
                  setIndex(Number(event.target.value))
                }}
              />
            </label>
            <div className="flex flex-wrap gap-2" role="tablist" aria-label="Playback speed">
              {SPEEDS.map((value) => (
                <ActionButton key={value} type="button" variant={value === speed ? 'primary' : 'ghost'} disabled={playbackOff} onClick={() => setSpeed(value)}>
                  {value}×
                </ActionButton>
              ))}
            </div>
            <div className="flex flex-wrap items-end gap-3">
              <label className="grid gap-1 text-sm">
                Grid
                <select
                  className="h-11 rounded border-2 border-[rgba(255,246,232,.6)] bg-comic-maroon px-3 text-ivory"
                  value={grid}
                  onChange={(event) => setGrid(Number(event.target.value))}
                >
                  {GRID_SIZES.map((size) => (
                    <option key={size} value={size}>
                      {size}×{size}
                    </option>
                  ))}
                </select>
              </label>
              <ActionButton type="button" onClick={newZip} disabled={busy || !code || !checksPassed(checks)}>
                New Zip
              </ActionButton>
              <ActionButton
                type="button"
                variant="ghost"
                disabled={busy || history.length < 2}
                onClick={() => {
                  setShowPrevious((value) => !value)
                  setIndex(0)
                  setPlaying(true)
                }}
              >
                {showPrevious ? 'Latest Zip' : 'Previous Zip'}
              </ActionButton>
            </div>
          </div>
        </Panel>
      </div>
    </PageFrame>
  )
}
