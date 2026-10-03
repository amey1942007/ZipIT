// @vitest-environment node
import { beforeAll, describe, expect, it } from 'vitest'
import runtimeSource from '@/workers/zipit_runtime.py?raw'
import engineSource from '@/workers/zipcomp/engine.py?raw'
import gameSource from '@/workers/zipcomp/game.py?raw'
import helpersInitSource from '@/workers/zipcomp/helpers_init.py?raw'
import helpersPrimitivesSource from '@/workers/zipcomp/helpers_primitives.py?raw'
import { SEARCH_TEMPLATE, TIEBREAKER_TEMPLATE } from '@/playground/templates'
import { puzzleToBoard } from '@/arena/engineCore'
import {
  BOARD_REFERENCE,
  EXAMPLE_PATH,
  EXAMPLE_PUZZLE,
  HELPER_DOCS,
  NODE_REFERENCE,
  RETURN_REFERENCE,
  type RefEntry,
} from '@/playground/reference'

interface PyodideProbe {
  runPython: (code: string) => unknown
  globals: { set: (name: string, value: unknown) => void }
}

const SEARCH = `from helpers import bfs_distance, free_degree, next_checkpoint, unvisited_component_size


class Score:
    name = "parity_probe"

    def score(self, node, board):
        remaining = board.n - node.depth
        if unvisited_component_size(node, board) != remaining:
            return -1e12
        target = next_checkpoint(node, board)
        if target is None:
            return node.depth
        walk = bfs_distance(board, node.head, target, node)
        if walk is None:
            return -1e11
        return node.depth * 10 - walk * 100 - free_degree(node, board)
`

const TIEBREAKER = `class TieBreaker:
    name = "greater_i_then_j"

    def key(self, node, board):
        i, j = board.rc(node.head)
        return (i, j)
`

/** Expected counts come from CPython 3.13 running ZipIt_ARIES@bf25282 on boards from its own generator. */
const PARITY = [
  {
    board: {
      id: 'parity_4242',
      width: 6,
      height: 6,
      checkpoints: [[3, 1], [0, 4], [1, 1], [2, 4], [3, 2], [5, 0], [5, 4]],
      walls: [[[0, 1], [1, 1]], [[1, 3], [2, 3]], [[0, 4], [1, 4]]],
    },
    expansions: 252,
    backtracks: 87,
    generated: 396,
  },
  {
    board: {
      id: 'parity_777',
      width: 7,
      height: 7,
      checkpoints: [[1, 3], [1, 0], [2, 1], [4, 2], [5, 6], [0, 5], [2, 5], [4, 3], [4, 4]],
      walls: [[[2, 4], [3, 4]], [[4, 1], [4, 2]], [[2, 1], [2, 2]], [[5, 0], [5, 1]]],
    },
    expansions: 4735,
    backtracks: 2127,
    generated: 8193,
  },
]

let py: PyodideProbe

function check(search: string, tiebreaker: string): { id: string; ok: boolean; message: string }[] {
  py.globals.set('_SEARCH_SRC', search)
  py.globals.set('_TB_SRC', tiebreaker)
  return JSON.parse(String(py.runPython('_check(_SEARCH_SRC, _TB_SRC)')))
}

function failed(search: string, tiebreaker = TIEBREAKER) {
  return check(search, tiebreaker).find((item) => !item.ok)
}

describe('pyodide engine runtime', () => {
  beforeAll(async () => {
    const loaded = (await import('pyodide')) as unknown as {
      loadPyodide: (opts: { jsglobals: Record<string, never> }) => Promise<PyodideProbe>
    }
    py = await loaded.loadPyodide({ jsglobals: {} })
    py.globals.set('_RUNTIME', runtimeSource)
    py.runPython('_exec_runtime = exec; _exec_runtime(_RUNTIME)')
    py.globals.set(
      '_ENGINE_SOURCES',
      JSON.stringify({
        game: gameSource,
        engine: engineSource,
        helpers_init: helpersInitSource,
        helpers_primitives: helpersPrimitivesSource,
      }),
    )
    py.runPython('_install_engine(_ENGINE_SOURCES)')
  }, 120_000)

  it('blocks the escape imports', () => {
    const blocked = String(
      py.runPython(`
import json
names = ["js", "pyodide_js", "pyodide.ffi", "pyodide.code", "pyodide.http", "pyodide.webloop", "micropip"]
out = []
for name in names:
    try:
        __import__(name)
        out.append(name + ":OPEN")
    except ImportError:
        out.append(name + ":BLOCKED")
json.dumps(out)
`),
    )
    expect(JSON.parse(blocked)).toEqual([
      'js:BLOCKED',
      'pyodide_js:BLOCKED',
      'pyodide.ffi:BLOCKED',
      'pyodide.code:BLOCKED',
      'pyodide.http:BLOCKED',
      'pyodide.webloop:BLOCKED',
      'micropip:BLOCKED',
    ])
  })

  it('passes all five checks for a valid submission', () => {
    const checks = check(SEARCH, TIEBREAKER)
    expect(checks.map((item) => item.id)).toEqual(['syntax', 'imports', 'classes', 'output', 'smoke'])
    expect(checks.every((item) => item.ok)).toBe(true)
  })

  it('rejects the untouched Playground starter templates', () => {
    expect(failed(SEARCH_TEMPLATE, TIEBREAKER_TEMPLATE)).toMatchObject({
      id: 'output',
      message: expect.stringMatching(/^search\.py line \d+: NotImplementedError: write your heuristic here/),
    })
    expect(failed(SEARCH, TIEBREAKER_TEMPLATE)).toMatchObject({
      id: 'output',
      message: expect.stringMatching(/^tiebreaker\.py line \d+: NotImplementedError/),
    })
  })

  it('reports each kind of problem with the file and line', () => {
    expect(failed('class Score:\n    def score(self, node, board)\n        return 1\n')).toMatchObject({
      id: 'syntax',
      message: expect.stringMatching(/^search\.py line 2/),
    })
    expect(failed('import os\nclass Score:\n    def score(self, node, board):\n        return 1\n')).toMatchObject({
      id: 'imports',
      message: expect.stringMatching(/import os is not allowed/),
    })
    expect(failed('class Scorer:\n    def score(self, node, board):\n        return 1\n')).toMatchObject({
      id: 'classes',
      message: expect.stringMatching(/class Score/),
    })
    expect(failed('class Score:\n    def score(self, node, board):\n        return float("nan")\n')).toMatchObject({
      id: 'output',
      message: expect.stringMatching(/finite/),
    })
    expect(
      failed(SEARCH, 'class TieBreaker:\n    def key(self, node, board):\n        return [1, 2]\n'),
    ).toMatchObject({ id: 'output', message: expect.stringMatching(/tuple/) })
    expect(failed('class Score:\n    def score(self, node, board):\n        return 1 / 0\n')).toMatchObject({
      id: 'output',
      message: expect.stringMatching(/search\.py line 3: ZeroDivisionError/),
    })
    expect(
      failed('class Score:\n    def score(self, node, board):\n        return 0\n    def prune(self, node, board):\n        return node.depth > 1\n'),
    ).toMatchObject({ id: 'smoke', message: expect.stringMatching(/warm-up/) })
  })

  it('shows the Playground reference values the engine really produces', () => {
    const entries: RefEntry[] = [
      ...[...BOARD_REFERENCE, ...NODE_REFERENCE, ...RETURN_REFERENCE].flatMap((section) => section.entries),
      ...HELPER_DOCS.flatMap((doc) => doc.examples),
    ]
    py.globals.set('_REF_BOARD', JSON.stringify(puzzleToBoard(EXAMPLE_PUZZLE, 'example')))
    py.globals.set('_REF_PATH', JSON.stringify(EXAMPLE_PATH))
    py.globals.set('_REF_EXPRS', JSON.stringify(entries.map((entry) => entry.expr)))
    const actual = JSON.parse(
      String(
        py.runPython(`
import json
import helpers
from zipcomp.game import Board

_b = Board.from_dict(json.loads(_REF_BOARD))
_path = json.loads(_REF_PATH)
assert _path[0] == _b.start
_n = _b.start_node()
for _cell in _path[1:]:
    _n = next(c for c in _b.successors(_n) if c.head == _cell)
_ns = {"board": _b, "node": _n, **{k: getattr(helpers, k) for k in helpers.__all__}}
_out = {}
for _expr in json.loads(_REF_EXPRS):
    try:
        _out[_expr] = repr(eval(_expr, dict(_ns)))
    except Exception as exc:
        _out[_expr] = "ERROR " + repr(exc)
json.dumps(_out)
`),
      ),
    ) as Record<string, string>
    const squash = (text: string) => text.replace(/\s+/g, '')
    for (const entry of entries) {
      expect({ expr: entry.expr, value: squash(actual[entry.expr] ?? '') }).toEqual({
        expr: entry.expr,
        value: squash(entry.value),
      })
    }
    expect(entries.length).toBeGreaterThan(40)
    const exported = JSON.parse(String(py.runPython('import helpers, json; json.dumps(sorted(helpers.__all__))')))
    expect(HELPER_DOCS.map((doc) => doc.name).sort()).toEqual(exported)
    for (const doc of HELPER_DOCS) {
      expect(doc.source.startsWith(`def ${doc.name}(`)).toBe(true)
      expect(doc.signature.startsWith(`${doc.name}(`)).toBe(true)
    }
  })

  it('matches CPython expansion counts on the same boards', () => {
    expect(check(SEARCH, TIEBREAKER).every((item) => item.ok)).toBe(true)
    for (const sample of PARITY) {
      py.globals.set('_BOARD_JSON', JSON.stringify(sample.board))
      const result = JSON.parse(String(py.runPython('_run(_BOARD_JSON, 200000, 60)')))
      expect(result.status).toBe('solved')
      expect(result.path).toHaveLength(sample.board.width * sample.board.height)
      expect(result.stats.expansions).toBe(sample.expansions)
      expect(result.stats.backtracks).toBe(sample.backtracks)
      expect(result.stats.generated).toBe(sample.generated)
    }
  }, 120_000)
})
