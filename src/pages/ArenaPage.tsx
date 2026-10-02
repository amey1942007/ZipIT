import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router'
import { frameAt } from '@/arena/playback'
import { REPLAY_SCORE_LABEL, replayScore } from '@/arena/scoreLocal'
import type { ReplayPuzzle, ReplayStep } from '@/arena/replayContract'
import { DEFAULT_GRID, GRID_SIZES, SPEEDS, SPEED_STEPS_PER_S } from '@/config/site'
import { ZipBoard } from '@/components/arena/ZipBoard'
import { PageFrame } from '@/components/PageFrame'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/lib/auth'
import { fetchReplay, fetchSubmissions } from '@/lib/data'
import { loadDemoZip, type DemoZip } from '@/lib/demo'
import { generatePuzzle } from '@/lib/zip/generate'
import type { ZipPuzzle } from '@/lib/zip/types'

type Mode = 'demo' | 'fresh' | 'run'

function asPuzzle(value: unknown): ReplayPuzzle | null {
  if (!value || typeof value !== 'object') return null
  const puzzle = value as ReplayPuzzle
  if (!Number.isInteger(puzzle.rows) || !Array.isArray(puzzle.waypoints) || !Array.isArray(puzzle.walls)) return null
  return { ...puzzle, seed: typeof puzzle.seed === 'number' ? puzzle.seed : 0 }
}

function asSteps(value: unknown): ReplayStep[] {
  if (!Array.isArray(value)) return []
  return value.filter((step): step is ReplayStep => {
    if (!Array.isArray(step) || step.length < 4) return false
    const [op, row, col, time] = step
    return (op === 'm' || op === 'b' || op === 'x') && [row, col, time].every((part) => typeof part === 'number')
  })
}

export function ArenaPage() {
  const { submissionId } = useParams()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const { team, isAdmin } = useAuth()
  const viewedTeam = params.get('team')
  const viewOnly = Boolean(isAdmin && viewedTeam && viewedTeam !== team?.id)
  const [demo, setDemo] = useState<DemoZip | null>(null)
  const [mode, setMode] = useState<Mode>(submissionId ? 'run' : 'demo')
  const [puzzle, setPuzzle] = useState<ZipPuzzle | null>(null)
  const [steps, setSteps] = useState<ReplayStep[]>([])
  const [index, setIndex] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState<(typeof SPEEDS)[number]>(1)
  const [grid, setGrid] = useState<number>(DEFAULT_GRID)
  const [note, setNote] = useState('')
  const [noRuns, setNoRuns] = useState(false)

  useEffect(() => {
    let stop = false
    void loadDemoZip()
      .then((loaded) => {
        if (stop) return
        setDemo(loaded)
        if (!submissionId) {
          setPuzzle(loaded.puzzle)
          setSteps(loaded.steps)
          setMode('demo')
          setPlaying(true)
        }
      })
      .catch(() => {
        if (!stop) setNote('Could not load the demo Zip.')
      })
    return () => {
      stop = true
    }
  }, [submissionId])

  useEffect(() => {
    if (!submissionId) return
    let stop = false
    setPlaying(false)
    setMode('run')
    void fetchReplay(submissionId).then((row) => {
      if (stop) return
      const nextPuzzle = asPuzzle(row?.puzzle)
      const nextSteps = asSteps(row?.steps)
      if (!nextPuzzle) {
        setNote('This run has no replay yet.')
        setPuzzle(null)
        setSteps([])
        return
      }
      setPuzzle(nextPuzzle)
      setSteps(nextSteps)
      setIndex(0)
      setPlaying(nextSteps.length > 0)
      setNote('')
    })
    return () => {
      stop = true
    }
  }, [submissionId])

  useEffect(() => {
    const teamId = viewedTeam || team?.id
    if (!teamId) return
    let stop = false
    void fetchSubmissions(teamId).then((rows) => {
      if (!stop) setNoRuns(rows.length === 0)
    })
    return () => {
      stop = true
    }
  }, [team?.id, viewedTeam])

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

  const frame = useMemo(() => {
    if (!puzzle) return null
    return frameAt({ ...puzzle, seed: 'seed' in puzzle ? Number(puzzle.seed) || 0 : 0 }, steps, index)
  }, [puzzle, steps, index])

  function showDemo() {
    if (!demo) return
    setMode('demo')
    setPuzzle(demo.puzzle)
    setSteps(demo.steps)
    setIndex(0)
    setPlaying(true)
    setNote('')
    navigate('/arena')
  }

  function newZip() {
    try {
      const generated = generatePuzzle({
        seed: Date.now() >>> 0,
        rows: grid,
        cols: grid,
        timeBudgetMs: 2500,
      })
      setMode('fresh')
      setPuzzle(generated)
      setSteps([])
      setIndex(0)
      setPlaying(false)
      setNote('This Zip has no solution loaded. Playback stays off.')
      navigate('/arena')
    } catch (error) {
      setNote(error instanceof Error ? error.message : 'Could not generate a Zip.')
    }
  }

  const playbackOff = mode === 'fresh' || steps.length === 0
  const depth = frame?.maxDepth ?? 0
  const score = puzzle ? replayScore(depth, puzzle.rows, puzzle.cols) : 0

  return (
    <PageFrame title="Arena">
      {noRuns ? <p className="rounded-xl border border-border bg-surface px-4 py-3">No runs yet</p> : null}
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full border border-gold px-3 py-1 text-sm text-gold">
          {mode === 'demo' ? 'Demo Zip with solution' : mode === 'fresh' ? 'New Zip' : 'Saved run'}
        </span>
        {mode === 'demo' ? <span className="rounded-full bg-gold px-3 py-1 text-sm font-semibold text-on-gold">Demo solution</span> : null}
      </div>
      {note ? <p className="text-text-muted">{note}</p> : null}
      <div className="grid items-start gap-6 lg:grid-cols-[auto_1fr]">
        {puzzle && frame ? (
          <ZipBoard puzzle={puzzle} path={frame.path} backtracked={frame.backtracked} head={frame.head} />
        ) : (
          <p className="text-text-muted">Loading the board…</p>
        )}
        <div className="grid max-w-md gap-4">
          <p className="font-mono text-text-muted">
            {REPLAY_SCORE_LABEL}: {score}
          </p>
          {mode === 'demo' ? <p className="text-sm text-text-muted">Official score is hidden on the demo.</p> : null}
          <div className="flex flex-wrap gap-2">
            <Button type="button" className="h-11 rounded-full text-white" disabled={playbackOff} onClick={() => setPlaying((value) => !value)}>
              {playing ? 'Pause' : 'Play'}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-11 rounded-full"
              disabled={playbackOff}
              onClick={() => {
                setPlaying(false)
                setIndex((value) => Math.max(0, value - 1))
              }}
            >
              Step back
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-11 rounded-full"
              disabled={playbackOff}
              onClick={() => {
                setPlaying(false)
                setIndex((value) => Math.min(steps.length, value + 1))
              }}
            >
              Step forward
            </Button>
          </div>
          <label className="grid gap-2 text-sm text-text-muted">
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
          <div className="flex flex-wrap gap-2">
            {SPEEDS.map((value) => (
              <Button
                key={value}
                type="button"
                variant={value === speed ? 'default' : 'outline'}
                className="h-11 rounded-full text-white"
                disabled={playbackOff}
                onClick={() => setSpeed(value)}
              >
                {value}×
              </Button>
            ))}
          </div>
          {viewOnly ? null : (
            <div className="flex flex-wrap items-end gap-3">
              <label className="grid gap-1 text-sm">
                Grid
                <select
                  className="h-11 rounded-xl border border-border-strong bg-surface-2 px-3"
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
              <Button type="button" className="h-11 rounded-full text-white" onClick={newZip}>
                New Zip
              </Button>
              <Button type="button" variant="outline" className="h-11 rounded-full" onClick={showDemo} disabled={!demo}>
                Previous Zip
              </Button>
            </div>
          )}
        </div>
      </div>
    </PageFrame>
  )
}
