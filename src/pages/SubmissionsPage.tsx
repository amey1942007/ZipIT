import { useCallback, useEffect, useRef, useState, type DragEvent } from 'react'
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
import { fetchSubmissions, uploadSubmission, type SubmissionRow } from '@/lib/data'
import { formatIst, formatScore } from '@/lib/format'
import { buildSlots } from '@/lib/slots'
import { uploadCheckList } from '@/lib/uploadChecks'
import { isSupabaseConfigured } from '@/lib/supabase'
import { useSubmissionFeed } from '@/lib/useLive'

export function SubmissionsPage() {
  const { team } = useAuth()
  const [rows, setRows] = useState<SubmissionRow[]>([])
  const [message, setMessage] = useState('')
  const [outcome, setOutcome] = useState<'ok' | 'error' | null>(null)
  const [checks, setChecks] = useState<boolean[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [over, setOver] = useState(false)
  const [preview, setPreview] = useState<string[]>([])
  const fileRef = useRef<HTMLInputElement>(null)

  const reload = useCallback(() => {
    if (!team) return
    void fetchSubmissions(team.id)
      .then(setRows)
      .catch(() => setMessage('Could not load submissions.'))
  }, [team])

  useEffect(() => {
    reload()
  }, [reload])
  useSubmissionFeed(team?.id ?? null, reload)

  async function take(list: File[]) {
    if (!team && isSupabaseConfigured) return
    const file = list[0]
    const report = uploadCheckList({
      names: list.map((item) => item.name),
      name: file?.name ?? '',
      size: file?.size ?? 0,
    })
    setChecks(report.map((item) => item.ok))
    const problem = report.find((item) => !item.ok)?.message ?? null
    if (problem || !file) {
      setOutcome('error')
      setMessage(problem ?? 'Upload one file at a time.')
      setPreview([])
      return
    }
    setBusy(true)
    setOutcome(null)
    setMessage('')
    void file.text().then((text) => setPreview(text.split('\n').slice(0, 10).map((line) => line.slice(0, 90)))).catch(() => setPreview([]))
    if (!isSupabaseConfigured || !team) {
      setOutcome('ok')
      setMessage('Preview only. Nothing was uploaded.')
      setBusy(false)
      return
    }
    try {
      await uploadSubmission(team.id, file)
      setOutcome('ok')
      setMessage('Uploaded. Scoring will update this page.')
      reload()
    } catch (error) {
      setOutcome('error')
      setMessage(error instanceof Error ? error.message : 'Upload failed. Check your connection and try again.')
    } finally {
      setBusy(false)
    }
  }

  function onDrop(event: DragEvent) {
    event.preventDefault()
    setOver(false)
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
              <li>One lowercase .py file</li>
              <li>Up to 256 KB</li>
              <li>The scorer calls next_move(grid, path, cost_map) and expects (r, c) back.</li>
            </ul>
            <label className="zi-abtn zi-abtn-primary zi-abtn-hero relative w-fit">
              <input
                ref={fileRef}
                className="sr-only"
                type="file"
                accept=".py,text/x-python"
                disabled={busy || (!team && isSupabaseConfigured)}
                onChange={(event) => {
                  void take(Array.from(event.target.files ?? []))
                  event.target.value = ''
                }}
              />
              {busy ? 'Uploading…' : 'Choose file'}
            </label>
            <Balloon>
              <p>Drop it in the big panel →</p>
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
                <p className="font-display text-3xl font-bold text-gold -skew-x-8">DROP YOUR .py HERE</p>
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
              <p className="mt-2 font-mono text-[13px] text-ivory-muted">or use Choose file · one .py · up to 256 KB</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {['One file', 'Lowercase .py', 'Not empty', '≤ 256 KB', 'Uploaded', 'Queued'].map((label, index) => (
                <CheckChip key={label} label={label} state={chipState(index, checks, outcome)} delay={index * 120} />
              ))}
            </div>
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
                    <span className="text-comic-red">{isSupabaseConfigured ? 'queued for Arena' : 'preview'}</span>
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
                  <p>{slot.scoring ? 'Scoring…' : slot.submission.status}</p>
                  <p className="font-display text-[40px] font-bold text-gold tabular-nums">{formatScore(slot.submission.score)}</p>
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
  if (index < 4) {
    if (firstBad === -1) return 'ok'
    if (index < firstBad) return 'ok'
    if (index === firstBad) return 'bad'
    return 'idle'
  }
  if (firstBad !== -1) return 'idle'
  if (outcome === 'ok') return 'ok'
  if (outcome === 'error' && index === 4) return 'bad'
  return 'idle'
}
