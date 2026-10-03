import { useCallback, useEffect, useRef, useState, type DragEvent } from 'react'
import { CHECK_LABELS, checksPassed, EngineClient } from '@/arena/engine'
import { PageFrame } from '@/components/PageFrame'
import { ActionButton } from '@/components/comic/ActionButton'
import { Balloon } from '@/components/comic/Balloon'
import { CaptionBox } from '@/components/comic/CaptionBox'
import { CheckChip } from '@/components/comic/CheckChip'
import { HudReadout } from '@/components/comic/HudReadout'
import { Panel } from '@/components/comic/Panel'
import { StampOverlay } from '@/components/comic/BurstPortal'
import { Sfx } from '@/components/comic/Sfx'
import { useAuth } from '@/lib/auth'
import { QUEUE_CAP } from '@/config/site'
import { fetchQueueDepth, fetchSubmissions, uploadSubmission, withdrawSubmission, type SubmissionRow } from '@/lib/data'
import { ADMIN_SUBMIT_MESSAGE, formatIst, formatScore, metricsLine } from '@/lib/format'
import { buildSlots, slotStatusText } from '@/lib/slots'
import { pairFiles, SEARCH_FILE, TIEBREAKER_FILE, uploadCheckList } from '@/lib/uploadChecks'
import { playZipped } from '@/lib/sfx'
import { clearStaged, readStaged, STAGED_DRAG_TYPE, stagedFiles, type StagedSubmission } from '@/lib/stagedSubmission'
import { isSupabaseConfigured } from '@/lib/supabase'
import { useSubmissionFeed } from '@/lib/useLive'
import { isUnchanged } from '@/playground/templates'

const QUEUE_POLL_MS = 15_000
const CHIP_LABELS = ['Two files', 'search.py + tiebreaker.py', 'Not empty', '≤ 256 KB each', 'Code checks', 'Uploaded', 'Queued']
/** Chips decided before upload: the four file checks plus the Python code checks. */
const PRE_UPLOAD_CHIPS = 5

export function SubmissionsPage() {
  const { team, isAdmin } = useAuth()
  const [rows, setRows] = useState<SubmissionRow[]>([])
  const [message, setMessage] = useState('')
  const [outcome, setOutcome] = useState<'ok' | 'error' | null>(null)
  const [checks, setChecks] = useState<boolean[] | null>(null)
  const [phase, setPhase] = useState<'checking' | 'uploading' | null>(null)
  const busy = phase !== null
  const [over, setOver] = useState(false)
  const [preview, setPreview] = useState<string[]>([])
  const [staged, setStaged] = useState<StagedSubmission | null>(() => readStaged())
  const [queue, setQueue] = useState<number | null>(null)
  const [withdrawing, setWithdrawing] = useState<string | null>(null)
  const [listNote, setListNote] = useState<{ text: string; error: boolean } | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const engine = useRef<EngineClient | null>(null)

  useEffect(() => {
    const client = new EngineClient()
    engine.current = client
    return () => client.dispose()
  }, [])

  const refreshQueue = useCallback(() => {
    void fetchQueueDepth().then(setQueue)
  }, [])

  const reload = useCallback(() => {
    if (!team) return
    void fetchSubmissions(team.id)
      .then(setRows)
      .catch(() => setMessage('Could not load submissions.'))
    refreshQueue()
  }, [team, refreshQueue])

  useEffect(() => {
    reload()
  }, [reload])
  useEffect(() => {
    if (!team) return
    const timer = window.setInterval(refreshQueue, QUEUE_POLL_MS)
    return () => window.clearInterval(timer)
  }, [team, refreshQueue])
  useSubmissionFeed(team?.id ?? null, reload)

  async function take(list: File[], source: 'upload' | 'playground' = 'upload') {
    if (busy || (!team && isSupabaseConfigured)) return
    if (isAdmin) {
      setChecks(null)
      setPreview([])
      setOutcome('error')
      setMessage(ADMIN_SUBMIT_MESSAGE)
      return
    }
    const report = uploadCheckList(list.map((item) => ({ name: item.name, size: item.size })))
    const fileChecks = report.map((item) => item.ok)
    setChecks(fileChecks)
    const problem = report.find((item) => !item.ok)?.message ?? null
    const pair = pairFiles(list)
    if (problem || !pair) {
      setOutcome('error')
      setMessage(problem ?? 'Upload both files together: search.py and tiebreaker.py.')
      setPreview([])
      return
    }
    const client = engine.current
    if (!client) return
    setPhase('checking')
    setOutcome(null)
    setMessage('')
    const rejectCode = (text: string) => {
      setChecks([...fileChecks, false])
      setOutcome('error')
      setMessage(text)
      setPhase(null)
    }
    let code: { search: string; tiebreaker: string }
    try {
      const [search, tiebreaker] = await Promise.all([pair.search.text(), pair.tiebreaker.text()])
      code = { search, tiebreaker }
    } catch {
      rejectCode("Couldn't read the files. Pick them again.")
      return
    }
    setPreview(code.search.split('\n').slice(0, 10).map((line) => line.slice(0, 90)))
    const untouched = (
      [
        [SEARCH_FILE, code.search],
        [TIEBREAKER_FILE, code.tiebreaker],
      ] as const
    )
      .filter(([name, text]) => isUnchanged(name, text))
      .map(([name]) => name)
    if (untouched.length) {
      rejectCode(`${untouched.join(' and ')} ${untouched.length > 1 ? 'are' : 'is'} still the starter template. Write your own code first.`)
      return
    }
    const reply = await client.check(code)
    if (reply.error) {
      rejectCode(`Couldn't check your code: ${reply.error}`)
      return
    }
    if (!checksPassed(reply.checks)) {
      const failed = reply.checks.find((item) => !item.ok)
      rejectCode(
        failed
          ? `${CHECK_LABELS[failed.id]} check failed: ${failed.message.replace(/\.?\s*$/, '.')} Nothing was uploaded.`
          : 'The code checks did not finish. Nothing was uploaded.',
      )
      return
    }
    setChecks([...fileChecks, true])
    if (!isSupabaseConfigured || !team) {
      setOutcome('ok')
      setMessage('Preview only. Code checks passed, nothing was uploaded.')
      playZipped()
      setPhase(null)
      return
    }
    setPhase('uploading')
    try {
      await uploadSubmission(team.id, pair, source)
      setOutcome('ok')
      setMessage('Uploaded and queued. The score shows here once the scorer finishes it. You can already run it in the Arena.')
      playZipped()
      if (source === 'playground') {
        clearStaged()
        setStaged(null)
      }
      reload()
    } catch (error) {
      setOutcome('error')
      setMessage(error instanceof Error ? error.message : 'Upload failed. Check your connection and try again.')
      refreshQueue()
    } finally {
      setPhase(null)
    }
  }

  async function withdraw(row: SubmissionRow) {
    if (!window.confirm(`Withdraw ${row.file_name}? It leaves the scoring queue and both files are deleted.`)) return
    setWithdrawing(row.id)
    setListNote(null)
    try {
      await withdrawSubmission(row.id)
      setListNote({ text: `Withdrew ${row.file_name}. Its queue slot is free.`, error: false })
    } catch (error) {
      setListNote({ text: error instanceof Error ? error.message : "Couldn't withdraw the run.", error: true })
    } finally {
      setWithdrawing(null)
      reload()
    }
  }

  function sendStaged() {
    if (staged) void take(stagedFiles(staged), 'playground')
  }

  function onDrop(event: DragEvent) {
    event.preventDefault()
    setOver(false)
    if (staged && Array.from(event.dataTransfer.types).includes(STAGED_DRAG_TYPE)) {
      sendStaged()
      return
    }
    void take(Array.from(event.dataTransfer.files))
  }

  const slots = buildSlots(rows)

  return (
    <PageFrame title="Submissions">
      <div className="grid gap-4 lg:grid-cols-[360fr_840fr]">
        <Panel fill="ivory" className="zi-enter-l">
          <div className="grid gap-4 p-5 text-ink">
            <HudReadout>YOUR FILES · PANEL 1/2</HudReadout>
            <ul className="grid gap-1 bg-ivory text-[15px] font-medium">
              <li>Two files, named exactly search.py and tiebreaker.py</li>
              <li>Up to 256 KB each</li>
              <li>search.py: class Score with score(self, node, board). Higher scores expand first.</li>
              <li>tiebreaker.py: class TieBreaker with key(self, node, board). The greater key wins a tie.</li>
              {queue != null ? (
                <li className="font-mono text-sm font-bold tabular-nums">
                  Scoring queue: {Math.min(queue, QUEUE_CAP)}/{QUEUE_CAP} in use
                </li>
              ) : null}
            </ul>
            {staged ? (
              <div className="grid gap-2">
                <HudReadout>FROM THE PLAYGROUND</HudReadout>
                <div
                  draggable={!busy}
                  onDragStart={(event) => {
                    event.dataTransfer.setData(STAGED_DRAG_TYPE, '1')
                    event.dataTransfer.effectAllowed = 'copy'
                  }}
                  className="grid cursor-grab gap-1 rounded border-[3px] border-dashed border-ink bg-ink p-3 font-mono text-sm font-bold text-ivory active:cursor-grabbing"
                  aria-label="Playground files: search.py and tiebreaker.py. Drag into the big panel."
                >
                  <span>search.py</span>
                  <span>tiebreaker.py</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  <ActionButton type="button" variant="ghost" disabled={busy} onClick={sendStaged}>
                    Send to panel
                  </ActionButton>
                  <ActionButton
                    type="button"
                    variant="ghost"
                    disabled={busy}
                    onClick={() => {
                      clearStaged()
                      setStaged(null)
                    }}
                  >
                    Discard
                  </ActionButton>
                </div>
              </div>
            ) : null}
            <label className="zi-abtn zi-abtn-primary zi-abtn-hero relative w-fit">
              <input
                ref={fileRef}
                className="sr-only"
                type="file"
                multiple
                accept=".py,text/x-python"
                disabled={busy || (!team && isSupabaseConfigured)}
                onChange={(event) => {
                  void take(Array.from(event.target.files ?? []))
                  event.target.value = ''
                }}
              />
              {phase === 'checking' ? 'Checking…' : phase === 'uploading' ? 'Uploading…' : 'Choose files'}
            </label>
            <Balloon>
              <p>{staged ? 'Drag your Playground files into the big panel →' : 'Drop both files in the big panel →'}</p>
            </Balloon>
          </div>
        </Panel>
        <Panel fill="maroon" className={outcome === 'ok' ? 'zi-enter-r zi-shake' : 'zi-enter-r'}>
          <div
            className={`grid h-full gap-4 p-5 ${over ? 'shadow-[0_0_30px_rgba(255,200,61,.45)]' : ''}`}
            onDragOver={(event) => {
              event.preventDefault()
              setOver(true)
            }}
            onDragLeave={() => setOver(false)}
            onDrop={onDrop}
          >
            <HudReadout>SUBMIT HEURISTIC · PANEL 2/2</HudReadout>
            <div
              className="zi-codebox cursor-pointer rounded border-[3px] border-dashed border-[rgba(255,200,61,.6)] bg-ink p-5"
              onClick={() => fileRef.current?.click()}
            >
              {busy ? <div className="zi-scan" aria-hidden /> : null}
              {preview.length === 0 ? (
                <p className="font-display text-3xl font-bold text-gold -skew-x-8">DROP search.py + tiebreaker.py HERE</p>
              ) : (
                <pre className="font-mono text-sm leading-relaxed text-ivory/80">
                  {preview.map((line, index) => (
                    <div key={index}>
                      <span className="mr-3 text-ivory/40">{index + 1}</span>
                      {line}
                    </div>
                  ))}
                </pre>
              )}
              <p className="mt-2 font-mono text-[13px] text-ivory-muted">or use Choose files · search.py + tiebreaker.py · up to 256 KB each</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {CHIP_LABELS.map((label, index) => (
                <CheckChip key={label} label={label} state={chipState(index, checks, outcome)} delay={index * 120} />
              ))}
            </div>
            {phase === 'checking' ? (
              <p role="status" className="font-mono text-sm text-ivory-muted">
                Checking your code before it joins the queue. The first check starts Python and can take a few seconds.
              </p>
            ) : null}
            {outcome === 'ok' ? (
              <>
                <StampOverlay>
                  <div className="grid place-items-center">
                    <Sfx preset="zipped" stamp={false} play holdMs={1600} label="ZIPPED!" />
                  </div>
                </StampOverlay>
                <CaptionBox className="zi-stamp">
                  <p className="font-display text-2xl font-bold">
                    ZIPPED! ·{' '}
                    <span className="text-comic-red">{isSupabaseConfigured ? 'queued for scoring' : 'preview'}</span>
                  </p>
                  <p>{message}</p>
                </CaptionBox>
              </>
            ) : null}
            {outcome === 'error' ? (
              <>
                <StampOverlay>
                  <CaptionBox tone="red" className="zi-stamp">
                    <p className="font-display text-6xl font-bold text-ivory" aria-hidden>
                      REJECTED
                    </p>
                  </CaptionBox>
                </StampOverlay>
                <div role="alert">
                  <CaptionBox tone="red" className="zi-stamp">
                    <p className="font-display text-[32px] font-bold text-ivory" aria-hidden>
                      REJECTED
                    </p>
                    <p className="text-ivory">{message}</p>
                  </CaptionBox>
                </div>
              </>
            ) : null}
            {message && outcome === 'ok' ? <p className="sr-only">Zipped. {message}</p> : null}
          </div>
        </Panel>
      </div>
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {slots.map((slot) => (
          <Panel key={slot.label} fill={slot.label === 'BEST' ? 'gold' : 'maroon'} className="min-h-52">
            <div className={`grid gap-1 p-4 ${slot.label === 'BEST' ? 'text-ink' : 'text-ivory'}`}>
              <HudReadout>{slot.label}</HudReadout>
              {slot.empty || !slot.submission ? (
                <p className="mt-3">No run yet</p>
              ) : (
                <>
                  <p className="truncate font-mono text-[15px] font-bold">{slot.submission.file_name}</p>
                  <p>{slotStatusText(slot)}</p>
                  <p className="font-display text-[40px] font-bold text-gold tabular-nums">{formatScore(slot.submission.score)}</p>
                  {metricsLine(slot.submission.metrics) ? (
                    <p className="font-mono text-xs font-bold tabular-nums">{metricsLine(slot.submission.metrics)}</p>
                  ) : null}
                  <p className="font-mono text-xs text-ivory-muted tabular-nums">{formatIst(slot.submission.created_at, true)}</p>
                  {slot.submission.error ? <p className="bg-comic-red px-2 py-1 text-ivory">{slot.submission.error}</p> : null}
                  {slot.also ? <p>Also {slot.also}</p> : null}
                  {slot.linkable ? (
                    <ActionButton to={`/arena/${slot.submission.id}`} variant="ghost">
                      Watch
                    </ActionButton>
                  ) : null}
                </>
              )}
            </div>
          </Panel>
        ))}
      </section>
      <Panel fill="plain">
        <div className="grid gap-2 p-4 text-ivory">
          <HudReadout>TEAM SUBMISSIONS</HudReadout>
          {listNote ? (
            <p role={listNote.error ? 'alert' : 'status'} className={listNote.error ? 'bg-comic-red px-2 py-1 text-ivory' : ''}>
              {listNote.text}
            </p>
          ) : null}
          {rows.length === 0 ? (
            <p>No submissions yet.</p>
          ) : (
            <ul className="grid gap-2">
              {rows.map((row) => (
                <li key={row.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-[rgba(255,246,232,.12)] py-2">
                  <span className="truncate font-mono text-sm font-bold">{row.file_name}</span>
                  <span className="font-mono text-xs font-bold tracking-[0.08em] uppercase">{row.status}</span>
                  {row.status === 'scored' ? (
                    <ActionButton to={`/arena/${row.id}`} variant="ghost">
                      Replay
                    </ActionButton>
                  ) : null}
                  {row.status === 'queued' && !isAdmin ? (
                    <ActionButton
                      variant="ghost"
                      disabled={withdrawing !== null}
                      aria-label={`Withdraw ${row.file_name}`}
                      onClick={() => void withdraw(row)}
                    >
                      {withdrawing === row.id ? 'Withdrawing…' : 'Withdraw'}
                    </ActionButton>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </div>
      </Panel>
    </PageFrame>
  )
}

function chipState(index: number, checks: boolean[] | null, outcome: 'ok' | 'error' | null): 'idle' | 'ok' | 'bad' {
  if (!checks) return 'idle'
  const firstBad = checks.findIndex((ok) => !ok)
  if (index < PRE_UPLOAD_CHIPS) {
    if (index >= checks.length) return 'idle'
    if (firstBad === -1 || index < firstBad) return 'ok'
    if (index === firstBad) return 'bad'
    return 'idle'
  }
  if (firstBad !== -1 || checks.length < PRE_UPLOAD_CHIPS) return 'idle'
  if (outcome === 'ok') return 'ok'
  if (outcome === 'error' && index === PRE_UPLOAD_CHIPS) return 'bad'
  return 'idle'
}
