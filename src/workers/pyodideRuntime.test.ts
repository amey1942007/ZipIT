// @vitest-environment node
import { describe, expect, it } from 'vitest'
import runtimeSource from '@/workers/zipit_runtime.py?raw'

interface PyodideProbe {
  runPython: (code: string) => unknown
  globals: { set: (name: string, value: unknown) => void }
}

describe('pyodide runtime blocker', () => {
  it(
    'blocks the escape imports and still returns a move',
    async () => {
      const loaded = (await import('pyodide')) as unknown as {
        loadPyodide: (opts: { jsglobals: Record<string, never> }) => Promise<PyodideProbe>
      }
      const { loadPyodide } = loaded
      const py = await loadPyodide({ jsglobals: {} })
      py.globals.set('_RUNTIME', runtimeSource)
      py.runPython('_exec_runtime = exec; _exec_runtime(_RUNTIME)')
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
      py.globals.set(
        '_USER_CODE',
        'def next_move(grid, path, cost_map):\n    return (0, 1)\n',
      )
      py.runPython('_install_user(_USER_CODE)')
      py.runPython('_load([[1, 0], [0, 2]], [], 2, 2)')
      py.runPython('_seed(1)')
      py.globals.set('_PATH_JSON', '[[0, 0]]')
      py.globals.set('_COST_JSON', '[[0, 1], [1, null]]')
      expect(JSON.parse(String(py.runPython('_call()')))).toEqual([0, 1])
    },
    60_000,
  )
})
