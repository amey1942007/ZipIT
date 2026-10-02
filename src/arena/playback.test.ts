import { describe, expect, it } from 'vitest'
import raw from '../../public/demo/zip-demo.v1.json?raw'
import { frameAt } from '@/arena/playback'
import { replayLog } from '@/arena/referee'
import type { DemoZip } from '@/lib/demo'

const demo = JSON.parse(raw) as DemoZip

describe('playback', () => {
  it('places the head on waypoint 1 before step 0, then matches the referee', () => {
    const start = frameAt(demo.puzzle, demo.steps, 0)
    expect(demo.steps[0]?.[0]).toBe('m')
    expect(start.path).toEqual([demo.puzzle.waypoints[0]])
    expect(start.head).toBe(demo.puzzle.waypoints[0])

    const done = frameAt(demo.puzzle, demo.steps, demo.steps.length)
    const checked = replayLog(demo.puzzle, demo.steps)
    expect(done.path).toEqual(checked.path)
    expect(done.head).toBe(demo.puzzle.waypoints.at(-1))
  })
})
