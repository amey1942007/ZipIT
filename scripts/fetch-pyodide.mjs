// Copy the pinned Pyodide browser runtime out of node_modules into public/.
// The files are gitignored. The worker loads them from the site origin.
import { createRequire } from 'node:module'
import { cpSync, existsSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'

const VERSION = '314.0.7'
const FILES = [
  'pyodide.mjs',
  'pyodide.asm.mjs',
  'pyodide.asm.wasm',
  'python_stdlib.zip',
  'pyodide-lock.json',
]

const require = createRequire(import.meta.url)
const srcDir = dirname(require.resolve('pyodide/package.json'))
const dest = join(process.cwd(), 'public', 'pyodide', VERSION)
mkdirSync(dest, { recursive: true })

for (const file of FILES) {
  const from = join(srcDir, file)
  if (!existsSync(from)) {
    console.error(`fetch-pyodide: missing ${from}`)
    process.exit(1)
  }
  cpSync(from, join(dest, file))
}

console.log(`pyodide ${VERSION} copied to ${dest}`)
