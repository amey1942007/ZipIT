/** Delete network and storage globals in the worker after Pyodide has loaded. */
export const LOCKED_GLOBALS = [
  'fetch',
  'XMLHttpRequest',
  'WebSocket',
  'EventSource',
  'importScripts',
  'indexedDB',
  'caches',
  'sendBeacon',
  'BroadcastChannel',
  'WebTransport',
  'Worker',
  'SharedWorker',
  'navigator',
] as const

export function lockdown(scope: object): void {
  const target = scope as Record<string, unknown>
  for (const name of LOCKED_GLOBALS) {
    try {
      Object.defineProperty(target, name, {
        value: undefined,
        writable: false,
        configurable: false,
      })
    } catch {
      // Missing or already non-configurable. The CSP is the other layer.
    }
  }
}
