import { describe, expect, it } from 'vitest'
import runtimeSource from '@/workers/zipit_runtime.py?raw'
import { LOCKED_GLOBALS, lockdown } from '@/workers/lockdown'

describe('worker lockdown', () => {
  it('stubs the network and storage globals', () => {
    const scope: Record<string, unknown> = {}
    for (const name of LOCKED_GLOBALS) scope[name] = () => name
    lockdown(scope)
    for (const name of LOCKED_GLOBALS) {
      expect(scope[name]).toBeUndefined()
      expect(Object.getOwnPropertyDescriptor(scope, name)?.writable).toBe(false)
    }
  })

  it('blocks the Python import list in the runtime source', () => {
    for (const name of [
      'js',
      'pyodide_js',
      'pyodide.ffi',
      'pyodide.code',
      'pyodide.http',
      'pyodide.webloop',
      'micropip',
    ]) {
      expect(runtimeSource).toContain(`"${name}"`)
    }
  })
})
