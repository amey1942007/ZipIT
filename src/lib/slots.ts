export interface SlotSubmission {
  id: string
  status: string
  score: number | null
  created_at: string
  error: string | null
  file_name: string
  scored_at: string | null
}

export type SlotLabel = 'BEST' | '2ND' | '3RD' | 'LATEST'

export interface SlotModel {
  label: SlotLabel
  submission: SlotSubmission | null
  empty: boolean
  scoring: boolean
  firstScoring: boolean
  also: SlotLabel | null
  linkable: boolean
}

const LABELS: SlotLabel[] = ['BEST', '2ND', '3RD']

function byScore(a: SlotSubmission, b: SlotSubmission): number {
  const score = (b.score ?? 0) - (a.score ?? 0)
  if (score !== 0) return score
  return a.created_at.localeCompare(b.created_at)
}

function newest(rows: SlotSubmission[]): SlotSubmission | null {
  return rows.slice().sort((a, b) => b.created_at.localeCompare(a.created_at))[0] ?? null
}

function emptySlot(label: SlotLabel): SlotModel {
  return {
    label,
    submission: null,
    empty: true,
    scoring: false,
    firstScoring: false,
    also: null,
    linkable: false,
  }
}

/** Four slots: top 3 scored runs, then the latest run of any status. */
export function buildSlots(rows: SlotSubmission[]): SlotModel[] {
  const inflight = newest(rows.filter((row) => row.status === 'queued' || row.status === 'running'))
  const finished = rows.filter((row) => row.status === 'scored' || row.status === 'failed')
  const scored = rows.filter((row) => row.status === 'scored').slice().sort(byScore)
  const top = [scored[0] ?? null, scored[1] ?? null, scored[2] ?? null]
  const latestFinished = newest(finished)
  const firstScoring = Boolean(inflight && !latestFinished)

  const topSlots: SlotModel[] = top.map((submission, index) => {
    const label = LABELS[index]!
    if (firstScoring && index === 0) {
      return {
        label,
        submission: inflight,
        empty: false,
        scoring: true,
        firstScoring: true,
        also: null,
        linkable: false,
      }
    }
    if (!submission) return emptySlot(label)
    return {
      label,
      submission,
      empty: false,
      scoring: false,
      firstScoring: false,
      also: null,
      linkable: true,
    }
  })

  let latest: SlotModel
  if (firstScoring && inflight) {
    latest = {
      label: 'LATEST',
      submission: inflight,
      empty: false,
      scoring: true,
      firstScoring: true,
      also: null,
      linkable: false,
    }
  } else if (inflight && latestFinished) {
    const place = top.findIndex((row) => row?.id === latestFinished.id)
    latest = {
      label: 'LATEST',
      submission: latestFinished,
      empty: false,
      scoring: true,
      firstScoring: false,
      also: place >= 0 ? LABELS[place]! : null,
      linkable: latestFinished.status === 'scored',
    }
  } else {
    const shown = newest(rows)
    const place = shown ? top.findIndex((row) => row?.id === shown.id) : -1
    latest = shown
      ? {
          label: 'LATEST',
          submission: shown,
          empty: false,
          scoring: false,
          firstScoring: false,
          also: place >= 0 ? LABELS[place]! : null,
          linkable: shown.status === 'scored',
        }
      : emptySlot('LATEST')
  }

  return [...topSlots, latest]
}
