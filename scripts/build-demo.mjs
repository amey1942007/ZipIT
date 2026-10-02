import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { replayLog } from '../src/arena/referee.ts'
import { generatePuzzle } from '../src/lib/zip/generate.ts'
import { cellRc } from '../src/lib/zip/types.ts'
import { buildNeighbors } from '../src/lib/vendor/zip-solver/solver.ts'
import { solve } from '../src/lib/vendor/zip-solver/solver.ts'

function loadPuzzle(seed) {
  const generated = generatePuzzle({ seed, rows: 6, cols: 6, wallFrac: 0.28, timeBudgetMs: 8_000 })
  const puzzle = {
    rows: generated.rows,
    cols: generated.cols,
    waypoints: generated.waypoints,
    walls: generated.walls,
    seed: generated.seed,
  }
  const found = solve(puzzle, { limit: 2, maxNodes: 200_000 })
  if (!found || found.aborted || found.solutions.length !== 1) return null
  const solution = found.solutions[0]
  if (solution[0] !== puzzle.waypoints[0] || solution.at(-1) !== puzzle.waypoints.at(-1) || solution.length !== 36) return null
  return { puzzle, solution }
}

let chosen = null
for (let seed = 1; seed <= 40 && !chosen; seed++) {
  const candidate = loadPuzzle(seed)
  if (!candidate) continue
  const neighbors = buildNeighbors(candidate.puzzle.rows, candidate.puzzle.cols, candidate.puzzle.walls)
  const order = new Int16Array(36)
  candidate.puzzle.waypoints.forEach((cell, index) => {
    order[cell] = index + 1
  })
  const last = candidate.puzzle.waypoints.at(-1)
  const admissible = (cell, nextWp, pathLength) => {
    const number = order[cell]
    if (!number) return true
    if (number !== nextWp) return false
    if (cell === last && pathLength + 1 !== 36) return false
    return true
  }
  let spurs = 0
  const visited = new Set([candidate.solution[0]])
  let nextWp = 2
  for (let index = 1; index < candidate.solution.length; index++) {
    const head = candidate.solution[index - 1]
    for (const side of neighbors[head] ?? []) {
      if (visited.has(side) || side === candidate.solution[index] || !admissible(side, nextWp, visited.size)) continue
      const trail = [side]
      const seen = new Set(visited)
      seen.add(side)
      let wp = order[side] ? nextWp + 1 : nextWp
      let ok = true
      while (trail.length < 8) {
        const options = (neighbors[trail.at(-1)] ?? []).filter((next) => !seen.has(next) && admissible(next, wp, seen.size))
        if (options.length === 0) break
        if (options.length !== 1) {
          ok = false
          break
        }
        trail.push(options[0])
        seen.add(options[0])
        if (order[options[0]]) wp += 1
      }
      const stuck = (neighbors[trail.at(-1)] ?? []).every((next) => seen.has(next) || !admissible(next, wp, seen.size))
      if (ok && stuck) spurs++
    }
    visited.add(candidate.solution[index])
    if (order[candidate.solution[index]]) nextWp++
  }
  if (spurs > 0) chosen = { ...candidate, spurs }
}
if (!chosen) throw new Error('no demo puzzle with a dead-end spur')
const { puzzle, solution } = chosen
console.log(`candidate seed=${puzzle.seed} walls=${puzzle.walls.length} spurs=${chosen.spurs}`)

const neighbors = buildNeighbors(puzzle.rows, puzzle.cols, puzzle.walls)
const order = new Int16Array(36)
puzzle.waypoints.forEach((cell, index) => {
  order[cell] = index + 1
})
const last = puzzle.waypoints.at(-1)

function admissible(cell, nextWp, pathLength) {
  const number = order[cell]
  if (!number) return true
  if (number !== nextWp) return false
  if (cell === last && pathLength + 1 !== 36) return false
  return true
}

const steps = []
let clock = 0
let detours = 0
const tick = () => {
  clock += 16
  return clock
}
const visited = new Set([solution[0]])
let nextWp = 2

for (let index = 1; index < solution.length; index++) {
  const head = solution[index - 1]
  if (detours < 4) {
    for (const side of neighbors[head] ?? []) {
      if (visited.has(side) || side === solution[index] || !admissible(side, nextWp, visited.size)) continue
      const trail = [side]
      const seen = new Set(visited)
      seen.add(side)
      let wp = order[side] ? nextWp + 1 : nextWp
      let ok = true
      while (trail.length < 8) {
        const options = (neighbors[trail.at(-1)] ?? []).filter((next) => !seen.has(next) && admissible(next, wp, seen.size))
        if (options.length === 0) break
        if (options.length !== 1) {
          ok = false
          break
        }
        const next = options[0]
        trail.push(next)
        seen.add(next)
        if (order[next]) wp += 1
      }
      const stuck = (neighbors[trail.at(-1)] ?? []).every((next) => seen.has(next) || !admissible(next, wp, seen.size))
      if (!ok || !stuck) continue
      for (const cell of trail) {
        const [r, c] = cellRc(cell, puzzle.cols)
        steps.push(['m', r, c, tick()])
      }
      for (const cell of [...trail].reverse()) {
        const [r, c] = cellRc(cell, puzzle.cols)
        steps.push(['b', r, c, tick()])
      }
      detours++
      break
    }
  }
  const next = solution[index]
  const [r, c] = cellRc(next, puzzle.cols)
  steps.push(['m', r, c, tick()])
  visited.add(next)
  if (order[next]) nextWp++
}

const checked = replayLog(puzzle, steps)
if (!checked.ok || checked.status !== 'solved' || detours < 1) {
  throw new Error(`${checked.error ?? checked.status} detours=${detours}`)
}
if (checked.path.join() !== solution.join()) throw new Error('path diverged')

const demo = {
  version: 1,
  seed: puzzle.seed,
  puzzle,
  solution,
  steps,
  summary: checked.summary,
}
const dest = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'demo', 'zip-demo.v1.json')
mkdirSync(dirname(dest), { recursive: true })
writeFileSync(dest, `${JSON.stringify(demo)}\n`)
console.log(`seed=${puzzle.seed} steps=${steps.length} backtracks=${checked.summary.backtracks}`)
