export const PYODIDE_VERSION = '314.0.7'

/** Same-origin URL of the copied runtime. No CDN host is baked in. */
export function pyodideIndexUrl(origin: string, baseUrl: string): string {
  const base = baseUrl.startsWith('/') ? baseUrl : `/${baseUrl}`
  const withSlash = base.endsWith('/') ? base : `${base}/`
  return new URL(`pyodide/${PYODIDE_VERSION}/`, `${origin}${withSlash}`).href
}
