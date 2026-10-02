export interface BroadcastRow {
  id: string
  team_id: string
  status: string
  [key: string]: unknown
}

export interface ParsedBroadcast {
  event: string
  operation: 'INSERT' | 'UPDATE' | 'DELETE' | string
  record: BroadcastRow | null
  oldRecord: BroadcastRow | null
}

let loggedShape = false

function asRow(value: unknown): BroadcastRow | null {
  if (!value || typeof value !== 'object') return null
  const row = value as Record<string, unknown>
  if (typeof row.id !== 'string' || typeof row.team_id !== 'string') return null
  return row as BroadcastRow
}

/**
 * Defensive parse of a private `team:<id>` broadcast.
 * Logs the raw shape once in dev, then ignores anything without a row id.
 */
export function parseSubmissionBroadcast(event: string, payload: unknown): ParsedBroadcast | null {
  if (import.meta.env.DEV && !loggedShape) {
    loggedShape = true
    console.info('[zipit] submission broadcast shape', { event, payload })
  }
  if (!payload || typeof payload !== 'object') return null
  const body = payload as Record<string, unknown>
  const operation = typeof body.operation === 'string' ? body.operation : event
  const record = asRow(body.record)
  const oldRecord = asRow(body.old_record) ?? asRow(body.old)
  if (!record && !oldRecord) return null
  return { event, operation, record, oldRecord }
}

export function resetBroadcastLogForTests(): void {
  loggedShape = false
}
