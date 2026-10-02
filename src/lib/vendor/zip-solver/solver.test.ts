import { describe, expect, it } from 'vitest'
import { solve, wallKey } from './solver'

function check(name: string, cond: boolean) {
  expect(cond, name).toBe(true)
}

const idx6 = (r: number, c: number) => r * 6 + c
const doubleDoors = {
  rows: 6,
  cols: 6,
  waypoints: [
    idx6(4, 1),
    idx6(2, 4),
    idx6(1, 4),
    idx6(4, 4),
    idx6(3, 4),
    idx6(3, 1),
    idx6(2, 1),
    idx6(1, 1),
  ],
  walls: [
    ...[1, 2, 3, 4].flatMap((r) => [
      wallKey(idx6(r, 0), idx6(r, 1)),
      wallKey(idx6(r, 4), idx6(r, 5)),
    ]),
    wallKey(idx6(0, 1), idx6(1, 1)),
    wallKey(idx6(4, 1), idx6(5, 1)),
    wallKey(idx6(0, 4), idx6(1, 4)),
    wallKey(idx6(4, 4), idx6(5, 4)),
    wallKey(idx6(0, 2), idx6(0, 3)),
    wallKey(idx6(1, 2), idx6(1, 3)),
    wallKey(idx6(4, 2), idx6(4, 3)),
    wallKey(idx6(5, 2), idx6(5, 3)),
  ],
}

describe('chi-feng solver', () => {
  it('keeps the original 14 checks', () => {
    {
      const res = solve(doubleDoors, { limit: 2 })!
      const sol = res.solutions[0]
      check('double doors: unique solution', res.solutions.length === 1)
      check(
        'double doors: covers all 36 cells',
        sol?.length === 36 && new Set(sol).size === 36,
      )
      check(
        'double doors: starts at 1, ends at 8',
        sol?.[0] === doubleDoors.waypoints[0] &&
          sol.at(-1) === doubleDoors.waypoints.at(-1),
      )
      check(
        'double doors: hits waypoints in order',
        JSON.stringify(sol?.filter((c) => doubleDoors.waypoints.includes(c))) ===
          JSON.stringify(doubleDoors.waypoints),
      )
    }

    const starter = {
      rows: 4,
      cols: 4,
      waypoints: [10, 12, 15, 1],
      walls: [wallKey(6, 7)],
    }
    {
      const res = solve(starter, { limit: 2 })!
      check('starter: unique solution', res.solutions.length === 1)
    }

    {
      const res = solve({ rows: 4, cols: 4, waypoints: [0, 15], walls: [] }, { limit: 2 })!
      check('parity-impossible board: unsolvable', res.solutions.length === 0)
    }

    {
      const res = solve({ rows: 4, cols: 4, waypoints: [0, 3], walls: [] }, { limit: 2 })!
      check('open board: multiple solutions', res.solutions.length === 2)
    }

    {
      const walls = [wallKey(0, 1), wallKey(0, 4)]
      const res = solve({ rows: 4, cols: 4, waypoints: [5, 15], walls })!
      check('isolated cell: unsolvable', res.solutions.length === 0)
    }

    {
      check(
        'prefix must start at 1',
        solve({ rows: 4, cols: 4, waypoints: [0, 3], walls: [] }, { prefix: [1] }) === null,
      )
      const res = solve(
        { rows: 4, cols: 4, waypoints: [0, 3], walls: [] },
        { prefix: [0, 4] },
      )!
      check('prefix respected', res.solutions[0]?.slice(0, 2).join() === '0,4')
    }

    {
      const res = solve({ rows: 3, cols: 3, waypoints: [0, 4], walls: [] })!
      const sol = res.solutions[0]
      check('solvable with last number mid-board', sol != null)
      check('path ends on the last number', sol?.at(-1) === 4)
    }

    {
      const res = solve({ rows: 8, cols: 8, waypoints: [0, 63], walls: [] })!
      check('parity prune is instant', res.solutions.length === 0 && res.nodes <= 2)
    }

    {
      const res = solve({ rows: 8, cols: 8, waypoints: [0, 7], walls: [] }, { maxNodes: 5 })!
      check('maxNodes aborts search', res.aborted === true)
    }
  })
})
