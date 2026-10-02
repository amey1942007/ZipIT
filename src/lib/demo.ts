import type { ReplayStep, ReplaySummary } from '@/arena/replayContract'
import type { ZipPuzzle } from '@/lib/zip/types'

export const DEMO_VERSION = 1

export interface DemoZip {
  version: typeof DEMO_VERSION
  seed: number
  puzzle: ZipPuzzle & { seed: number }
  solution: number[]
  steps: ReplayStep[]
  summary: ReplaySummary
}

/** The only read path for the shipped demo. A later row can replace this fetch. */
export async function loadDemoZip(): Promise<DemoZip> {
  const response = await fetch(`${import.meta.env.BASE_URL}demo/zip-demo.v1.json`)
  if (!response.ok) throw new Error('Could not load the demo Zip.')
  return response.json() as Promise<DemoZip>
}
