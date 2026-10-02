import path from 'node:path'
import { fileURLToPath } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { loadEnv, type Plugin } from 'vite'
import { defineConfig } from 'vitest/config'

const root = path.dirname(fileURLToPath(import.meta.url))

/** Rewrites the CSP meta from the env URL. No host is hard-coded. */
function cspMeta(supabaseUrl: string | undefined): Plugin {
  let connect = "connect-src 'self'"
  let img = "img-src 'self' data: blob:"
  if (supabaseUrl) {
    try {
      const host = new URL(supabaseUrl).host
      if (host) {
        connect += ` https://${host} wss://${host}`
        img += ` https://${host}`
      }
    } catch {
      // An empty or invalid URL still builds. The app shows its own notice.
    }
  }
  const content = [
    "default-src 'self'",
    "script-src 'self' 'wasm-unsafe-eval'",
    "worker-src 'self' blob:",
    connect,
    img,
    "style-src 'self' 'unsafe-inline'",
    "font-src 'self'",
    "media-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'none'",
  ].join('; ')
  const meta = `<meta http-equiv="Content-Security-Policy" content="${content}">`
  return {
    name: 'zipit-csp-meta',
    transformIndexHtml(html) {
      if (html.includes('http-equiv="Content-Security-Policy"')) {
        return html.replace(
          /<meta\s+http-equiv="Content-Security-Policy"[\s\S]*?>/,
          meta,
        )
      }
      return html.replace('<head>', `<head>\n    ${meta}`)
    },
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, root, 'VITE_')
  return {
    base: '/ZipIT/',
    plugins: [react(), tailwindcss(), cspMeta(env.VITE_SUPABASE_URL)],
    resolve: {
      alias: {
        '@': path.resolve(root, 'src'),
      },
    },
    worker: { format: 'es' },
    build: {
      target: 'es2022',
      sourcemap: true,
      assetsInlineLimit(filePath) {
        if (/\.(?:woff2?|ttf|otf)$/i.test(filePath)) return false
      },
    },
    server: { port: 5173 },
    preview: { port: 4173 },
    test: {
      environment: 'jsdom',
      setupFiles: ['./src/test/setup.ts'],
      testTimeout: 20_000,
    },
  }
})
