import runtimeSource from '@/workers/zipit_runtime.py?raw'
import engineSource from '@/workers/zipcomp/engine.py?raw'
import gameSource from '@/workers/zipcomp/game.py?raw'
import helpersInitSource from '@/workers/zipcomp/helpers_init.py?raw'
import helpersPrimitivesSource from '@/workers/zipcomp/helpers_primitives.py?raw'
import { lockdown } from '@/workers/lockdown'

interface PyBytes {
  toJs: () => Uint8Array
  destroy: () => void
}

interface PyProxy {
  runPython: (code: string) => unknown
  globals: { set: (name: string, value: unknown) => void; get: (name: string) => unknown }
}

type LoadPyodide = (opts: {
  indexURL: string
  packageBaseUrl: string
  jsglobals: Record<string, never>
  env: Record<string, string>
  stdout: (chunk: string) => void
  stderr: (chunk: string) => void
  packages: string[]
}) => Promise<PyProxy>

interface InMessage {
  type?: string
  id?: number
  indexURL?: string
  search?: string
  tiebreaker?: string
  board?: unknown
  maxExpansions?: number
  timeLimit?: number
}

const scope = self as unknown as {
  postMessage: (data: unknown, transfer?: Transferable[]) => void
  onmessage: ((event: MessageEvent<unknown>) => void) | null
}

const CODE_MAX = 262_144
let py: PyProxy | null = null

function post(message: unknown) {
  scope.postMessage(JSON.parse(JSON.stringify(message)))
}

/** Copies _LAST_TRACE out of Python into a buffer of its own, so it can be transferred. */
function takeTrace(active: PyProxy): Uint8Array | null {
  const proxy = active.globals.get('_LAST_TRACE') as PyBytes | null | undefined
  if (!proxy || typeof proxy.toJs !== 'function') return null
  try {
    return proxy.toJs().slice()
  } finally {
    proxy.destroy()
    active.runPython('_LAST_TRACE = None')
  }
}

function discard(): (chunk: string) => void {
  return () => {}
}

function errorText(err: unknown): string {
  return String(err instanceof Error ? err.message : err).slice(0, 500)
}

async function boot(indexURL: string) {
  try {
    const href = indexURL.endsWith('/') ? indexURL : `${indexURL}/`
    const mod = (await import(/* @vite-ignore */ `${href}pyodide.mjs`)) as { loadPyodide: LoadPyodide }
    py = await mod.loadPyodide({
      indexURL: href,
      packageBaseUrl: href,
      jsglobals: {},
      env: { PYTHONHASHSEED: '0' },
      stdout: discard(),
      stderr: discard(),
      packages: [],
    })
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
    lockdown(scope)
    post({ type: 'ready' })
  } catch (err) {
    post({ type: 'error', error: errorText(err) })
  }
}

function check(active: PyProxy, search: string, tiebreaker: string): unknown[] {
  active.globals.set('_SEARCH_SRC', search)
  active.globals.set('_TB_SRC', tiebreaker)
  return JSON.parse(String(active.runPython('_check(_SEARCH_SRC, _TB_SRC)'))) as unknown[]
}

scope.onmessage = (event: MessageEvent<unknown>) => {
  const data = typeof event.data === 'string' ? event.data : JSON.stringify(event.data)
  let message: InMessage
  try {
    message = JSON.parse(data) as InMessage
  } catch {
    return
  }
  if (message.type === 'init' && message.indexURL) {
    void boot(message.indexURL)
    return
  }
  const active = py
  if (!active || typeof message.id !== 'number') return
  const search = typeof message.search === 'string' ? message.search : ''
  const tiebreaker = typeof message.tiebreaker === 'string' ? message.tiebreaker : ''
  if (search.length > CODE_MAX || tiebreaker.length > CODE_MAX) {
    post({ type: 'failed', id: message.id, error: 'Each file must be 256 KB or less.' })
    return
  }
  try {
    const checks = check(active, search, tiebreaker)
    if (message.type === 'check') {
      post({ type: 'checked', id: message.id, checks })
      return
    }
    if (message.type !== 'run') return
    const passed = checks.every((item) => (item as { ok?: boolean }).ok === true) && checks.length === 5
    if (!passed) {
      post({ type: 'ran', id: message.id, checks, result: null })
      return
    }
    active.globals.set('_BOARD_JSON', JSON.stringify(message.board ?? {}))
    const maxExpansions = Math.max(1, Math.min(Number(message.maxExpansions) || 200_000, 2_000_000))
    const timeLimit = Math.max(0.1, Math.min(Number(message.timeLimit) || 20, 60))
    const result = JSON.parse(String(active.runPython(`_run(_BOARD_JSON, ${maxExpansions}, ${timeLimit})`))) as unknown
    const trace = takeTrace(active)
    const reply = JSON.parse(JSON.stringify({ type: 'ran', id: message.id, checks, result })) as Record<string, unknown>
    if (trace) scope.postMessage({ ...reply, trace }, [trace.buffer])
    else scope.postMessage(reply)
  } catch (err) {
    post({ type: 'failed', id: message.id, error: errorText(err) })
  }
}
