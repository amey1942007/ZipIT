import { useCallback, useEffect, useState, type DragEvent } from 'react'
import { Link } from 'react-router'
import { PageFrame } from '@/components/PageFrame'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/lib/auth'
import { fetchSubmissions, uploadSubmission, type SubmissionRow } from '@/lib/data'
import { formatIst, formatScore } from '@/lib/format'
import { buildSlots } from '@/lib/slots'
import { firstUploadError } from '@/lib/uploadChecks'
import { useSubmissionFeed } from '@/lib/useLive'

export function SubmissionsPage() {
  const { team } = useAuth()
  const [rows, setRows] = useState<SubmissionRow[]>([])
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [over, setOver] = useState(false)

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
    if (!team) return
    const file = list[0]
    const problem = firstUploadError({
      names: list.map((item) => item.name),
      name: file?.name ?? '',
      size: file?.size ?? 0,
    })
    if (problem || !file) {
      setMessage(problem ?? 'Upload one file at a time.')
      return
    }
    setBusy(true)
    setMessage('')
    try {
      await uploadSubmission(team.id, file)
      setMessage('Uploaded. Scoring will update this page.')
      reload()
    } catch (error) {
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
      <section
        className={`rounded-xl border border-dashed p-6 ${over ? 'border-gold bg-surface-2' : 'border-border-strong bg-surface'}`}
        onDragOver={(event) => {
          event.preventDefault()
          setOver(true)
        }}
        onDragLeave={() => setOver(false)}
        onDrop={onDrop}
      >
        <h2 className="text-h4">Upload a .py file</h2>
        <p className="mt-1 text-text-muted">One lowercase .py file, up to 256 KB.</p>
        <label className="mt-4 inline-flex">
          <input
            className="sr-only"
            type="file"
            accept=".py,text/x-python"
            disabled={busy || !team}
            onChange={(event) => {
              void take(Array.from(event.target.files ?? []))
              event.target.value = ''
            }}
          />
          <span className="inline-flex h-11 cursor-pointer items-center rounded-full bg-primary px-5 font-semibold text-white">
            {busy ? 'Uploading…' : 'Choose file'}
          </span>
        </label>
        {message ? <p className="mt-3 text-text-muted">{message}</p> : null}
      </section>
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {slots.map((slot) => (
          <article key={slot.label} className="rounded-xl border border-border bg-surface p-4">
            <h2 className="text-sm font-semibold tracking-[0.08em] text-gold">{slot.label}</h2>
            {slot.empty || !slot.submission ? (
              <p className="mt-3 text-text-muted">No run yet</p>
            ) : (
              <div className="mt-3 grid gap-1">
                <p className="truncate font-semibold">{slot.submission.file_name}</p>
                <p className="text-text-muted">{slot.scoring ? 'Scoring…' : slot.submission.status}</p>
                <p className="zi-score text-h4">{formatScore(slot.submission.score)}</p>
                <p className="text-sm text-text-muted">{formatIst(slot.submission.created_at, true)}</p>
                {slot.submission.error ? <p className="text-danger">{slot.submission.error}</p> : null}
                {slot.also ? <p className="text-sm text-gold">Also {slot.also}</p> : null}
                {slot.linkable ? (
                  <Button asChild variant="outline" className="mt-2 h-11 rounded-full">
                    <Link to={`/arena/${slot.submission.id}`}>Watch</Link>
                  </Button>
                ) : null}
              </div>
            )}
          </article>
        ))}
      </section>
    </PageFrame>
  )
}
