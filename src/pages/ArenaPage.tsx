import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router'
import {
  ARENA_LIMITS,
  CHECK_LABELS,
  CHECK_ORDER,
  checksPassed,
  EngineClient,
  formatElapsed,
  GRADING_LIMITS,
  statusLabels,
  type CheckResult,
  type EngineResult,
  type SubmissionCode,
} from '@/arena/engine'
import { gradingVerdict } from '@/arena/grading'
import { indexTrace, traceFrame, type TraceFrame, type TraceIndex } from '@/arena/trace'
import { fetchArenaReplays, replayKeepIds, saveArenaReplay, type SavedReplay } from '@/lib/arenaReplays'
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
/** Autoplay picks the slowest speed that shows the whole search in about this long. */
const AUTOPLAY_TARGET_S = 20
const ARENA_STATUS = statusLabels(ARENA_LIMITS)
const GRADING_CAP = GRADING_LIMITS.maxExpansions.toLocaleString('en-IN')

interface ZipEntry {
  key: number
  puzzle: GeneratedPuzzle
  result: EngineResult | null
  trace: TraceIndex | null
}

interface SaveTarget {
  teamId: string
  submissionId: string
  keep: string[]
}

function autoSpeed(frames: number): (typeof SPEEDS)[number] {
  return SPEEDS.find((value) => frames / SPEED_STEPS_PER_S[value] <= AUTOPLAY_TARGET_S) ?? SPEEDS[SPEEDS.length - 1]!
}

function finalFrame(puzzle: GeneratedPuzzle, result: EngineResult | null): TraceFrame {
  const path = result?.path.length ? result.path : [puzzle.waypoints[0] ?? 0]
  return {
    path,
    abandoned: [],
    head: path[path.length - 1] ?? null,
    jumped: false,
    tie: false,
    score: Number.NaN,
    backtracksSoFar: 0,
    waypointsReached: puzzle.waypoints.filter((cell) => path.includes(cell)).length,
  }
}

function stepText(frame: TraceFrame, index: number, traced: boolean): string {
  if (!traced) return '—'
  const kind = index === 0 ? 'Start on dot 1' : frame.jumped ? 'Backtracked: jumped to another branch' : 'Extended the path'
  const tie = frame.tie ? `${kind} · the tie-breaker decided` : kind
  return index >= GRADING_LIMITS.maxExpansions ? `${tie} · past the scorer's ${GRADING_CAP} limit` : tie
}

function savedEntry(key: number, replay: SavedReplay): ZipEntry {
  return { key, puzzle: replay.puzzle, result: replay.result, trace: replay.result.trace ? indexTrace(replay.result.trace) : null }
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
  const [saveNote, setSaveNote] = useState('')
  const [checking, setChecking] = useState(false)
  const [runStartedAt, setRunStartedAt] = useState<number | null>(null)
  const [clock, setClock] = useState(0)
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
  const ownRun = Boolean(selected && team && !isAdmin && !viewOnly && selected.team_id === team.id)
  const saveTarget = useMemo<SaveTarget | null>(() => {
    if (!ownRun || !selected || !rows || !team) return null
    const keep = replayKeepIds(rows)
    return keep.includes(selected.id) ? { teamId: team.id, submissionId: selected.id, keep } : null
  }, [ownRun, selected, rows, team])
  const saveTargetRef = useRef(saveTarget)
  useEffect(() => {
    saveTargetRef.current = saveTarget
  }, [saveTarget])
  const [shownId, setShownId] = useState<string | null>(null)
  if ((selected?.id ?? null) !== shownId) {
    setShownId(selected?.id ?? null)
    setCode(null)
    setChecks(null)
    setHistory([])
    setShowPrevious(false)
    setPlaying(false)
    setSaveNote('')
    if (selected) setNote('Loading the submission…')
  }

  const entry = showPrevious && history.length >= 2 ? history[history.length - 2]! : history[history.length - 1] ?? null
  const puzzle = entry?.puzzle ?? null
  const traced = entry?.trace ?? null
  const frames = traced?.size ?? 0
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

  useEffect(() => {
    if (runStartedAt == null) return
    const timer = window.setInterval(() => setClock(Date.now()), 500)
    return () => window.clearInterval(timer)
  }, [runStartedAt])

  const runOn = useCallback(async (source: SubmissionCode, size: number) => {
    const client = engine.current
    if (!client) return
    const target = saveTargetRef.current
    const load = loadRef.current
    let generated: GeneratedPuzzle
    try {
      generated = generatePuzzle({ seed: Date.now() >>> 0, rows: size, cols: size, timeBudgetMs: 2500 })
    } catch (error) {
      setNote(error instanceof Error ? error.message : 'Could not generate a Zip.')
      return
    }
    const key = ++keyRef.current
    setHistory((list) => [...list, { key, puzzle: generated, result: null, trace: null }].slice(-HISTORY_SIZE))
    setShowPrevious(false)
    setIndex(0)
    setPlaying(false)
    setBusy(true)
    setSaveNote('')
    const started = Date.now()
    setClock(started)
    setRunStartedAt(started)
    setNote('Running your code on this Zip…')
    const reply = await client.run(source, generated, ARENA_LIMITS)
    setBusy(false)
    setRunStartedAt(null)
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
    const trace = result.trace ? indexTrace(result.trace) : null
    setHistory((list) => list.map((item) => (item.key === key ? { ...item, result, trace } : item)))
    setIndex(0)
    if (trace) setSpeed(autoSpeed(trace.size))
    setPlaying((trace?.size ?? 0) > 1)
    const expansions = result.stats.expansions
    if (!trace) {
      setNote('This run sent back no search log, so only the final path is shown.')
    } else if (typeof expansions === 'number' && expansions !== trace.size) {
      setNote(`The search log has ${trace.size} of ${expansions} expansions.`)
    } else if (!result.solved) {
      setNote(`${ARENA_STATUS[result.status]}. Every expansion is shown: scrub back to see where the search went wrong.`)
    } else {
      setNote('')
    }
    if (!target || !result.traceBytes) return
    setSaveNote('Saving this replay…')
    let saved: string
    try {
      await saveArenaReplay({ ...target, puzzle: generated, result })
      saved = 'Replay saved. It loads here next time.'
    } catch (error) {
      saved = error instanceof Error ? error.message : "Couldn't save this replay."
    }
    if (load === loadRef.current) setSaveNote(saved)
  }, [])

  useEffect(() => {
    if (!selected) return
    const load = ++loadRef.current
    let stop = false
    const current = () => !stop && load === loadRef.current
    const saved = fetchArenaReplays(selected.id).catch(() => ({ replays: [] as SavedReplay[], missing: -1 }))
    void downloadSubmissionFiles(selected)
      .then(async (files) => {
        if (!current()) return
        setCode(files)
        const { replays, missing } = await saved
        if (!current()) return
        const kept = replays.slice(-HISTORY_SIZE)
        const latest = kept[kept.length - 1]
        if (latest) {
          const entries = kept.map((replay) => savedEntry(++keyRef.current, replay))
          const size = entries[entries.length - 1]!.trace?.size ?? 0
          setHistory(entries)
          setShowPrevious(false)
          setIndex(0)
          setSpeed(autoSpeed(size))
          setPlaying(size > 1)
          setSaveNote(
            `Saved replay from ${formatIst(latest.createdAt, true)}.${missing > 0 ? ' One saved replay could not be loaded.' : ''} New Zip runs your code on a fresh board.`,
          )
        } else if (missing !== 0) {
          setSaveNote(missing < 0 ? "Couldn't load the saved replays." : 'A saved replay could not be loaded.')
        }
        setChecking(true)
        setNote('Starting Python and checking your code…')
        const reply = await engine.current?.check(files)
        if (!current() || !reply) return
        setChecking(false)
        setChecks(reply.checks)
        if (reply.error) {
          setNote(reply.error)
          return
        }
        if (!checksPassed(reply.checks) || latest) {
          setNote('')
          return
        }
        await runOn(files, gridRef.current)
      })
      .catch(() => {
        if (!stop) {
          setChecking(false)
          setNote('Could not download this submission.')
        }
      })
    return () => {
      stop = true
    }
  }, [selected, runOn])

  useEffect(() => {
    if (!playing || frames <= 1) return
    const rate = SPEED_STEPS_PER_S[speed]
    const tickMs = Math.max(1000 / rate, 33)
    const perTick = Math.max(1, Math.round((rate * tickMs) / 1000))
    const timer = window.setInterval(() => {
      setIndex((current) => {
        if (current >= frames - 1) {
          setPlaying(false)
          return current
        }
        return Math.min(frames - 1, current + perTick)
      })
    }, tickMs)
    return () => window.clearInterval(timer)
  }, [playing, speed, frames])

  const result = entry?.result ?? null
  const frame = useMemo(() => {
    if (!puzzle) return null
    return traced ? traceFrame(traced, index, puzzle.waypoints) : finalFrame(puzzle, result)
  }, [puzzle, traced, index, result])

  function pick(id: string) {
    const query = viewedTeam ? `?team=${encodeURIComponent(viewedTeam)}` : ''
    navigate(`/arena/${id}${query}`)
  }

  function newZip() {
    if (code && checksPassed(checks)) void runOn(code, grid)
  }

  const runningFor = runStartedAt == null ? 0 : Math.max(0, (clock - runStartedAt) / 1000)
  const verdict = result && !busy ? gradingVerdict(result, ARENA_LIMITS) : null
  const saveHint =
    ownRun && !saveTarget ? 'Replays are saved only for the runs in your BEST, 2ND, 3RD and LATEST slots.' : ''
  const playbackOff = frames <= 1 || busy
  const last = Math.max(frames - 1, 0)
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
          <Link to="/playground" className="font-semibold text-gold">
            Write search.py and tiebreaker.py in the Playground
          </Link>{' '}
          or{' '}
          <Link to="/submissions" className="font-semibold text-gold">
            upload them
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
      {saveNote || saveHint ? <p className="text-text-muted">{saveNote || saveHint}</p> : null}
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
                  backtracked={frame.abandoned}
                  head={frame.head}
                  cell={cell}
                  showLine={frame.path.length > 1}
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
              <p>Status: {busy ? `Running… ${Math.floor(runningFor)} s` : result ? ARENA_STATUS[result.status] : '—'}</p>
              <p>
                Expansion:{' '}
                {traced ? `${(Math.min(index, last) + 1).toLocaleString('en-IN')} of ${frames.toLocaleString('en-IN')}` : (stats.expansions ?? '—')}
              </p>
              <p>This step: {frame ? stepText(frame, index, Boolean(traced)) : '—'}</p>
              <p>Score: {frame && Number.isFinite(frame.score) ? formatScore(frame.score) : '—'}</p>
              <p>
                Path: {frame ? frame.path.length : 0}/{total || '—'} cells
              </p>
              <p>
                Backtracks:{' '}
                {traced && frame
                  ? `${frame.backtracksSoFar.toLocaleString('en-IN')} of ${traced.totalBacktracks.toLocaleString('en-IN')}`
                  : (stats.backtracks ?? '—')}
              </p>
              <p>Time: {formatElapsed(stats.elapsed)}</p>
            </div>
            {traced ? (
              <p className="text-sm text-text-muted">
                Each step is one node your code made the engine expand. Hatched cells are the branch it last gave up.
              </p>
            ) : null}
            {busy && runningFor > GRADING_LIMITS.timeLimitS ? (
              <p role="alert" className="bg-comic-red px-2 py-1 font-mono text-sm text-ivory">
                Still running after {Math.floor(runningFor)} s. The scorer stops at {GRADING_LIMITS.timeLimitS} s, so this board
                likely won&apos;t count. The Arena keeps going up to {ARENA_LIMITS.timeLimitS} s so you can see where the search
                ends up.
              </p>
            ) : null}
            {verdict && !verdict.counts ? (
              <div role="alert" className="grid gap-1 bg-comic-red px-2 py-1 font-mono text-sm text-ivory">
                <p className="font-bold">Won&apos;t count on the scorer</p>
                {verdict.reasons.map((reason) => (
                  <p key={reason}>{reason}</p>
                ))}
              </div>
            ) : null}
            <p className="text-sm text-text-muted">Arena runs are practice only. Official scores come from the scorer.</p>
            <div className="flex flex-wrap gap-2">
              <ActionButton
                type="button"
                disabled={playbackOff}
                onClick={() => {
                  if (!playing && index >= last) setIndex(0)
                  setPlaying((value) => !value)
                }}
              >
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
                  setIndex((value) => Math.min(last, value + 1))
                }}
              >
                Step forward
              </ActionButton>
              <ActionButton
                variant="ghost"
                type="button"
                disabled={playbackOff}
                onClick={() => {
                  setPlaying(false)
                  setIndex(last)
                }}
              >
                Jump to end
              </ActionButton>
            </div>
            <label className="grid gap-2 text-sm text-ivory-muted">
              Seek
              <input
                type="range"
                min={0}
                max={last}
                value={Math.min(index, last)}
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
              <ActionButton type="button" onClick={newZip} disabled={busy || checking || !code || !checksPassed(checks)}>
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
