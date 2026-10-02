export function GutterPath({ d, progress = 1 }: { d: string; progress?: number }) {
  const offset = 1 - progress
  const shared = {
    d,
    fill: 'none',
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    pathLength: 1,
    strokeDasharray: '1 1',
    strokeDashoffset: offset,
  }
  return (
    <svg className="pointer-events-none absolute inset-0 h-full w-full overflow-visible" aria-hidden>
      <path {...shared} stroke="var(--zi-gold-c)" strokeWidth="var(--zi-path-edge-w)" />
      <path {...shared} stroke="var(--zi-red-c)" strokeWidth="var(--zi-path-core-w)" />
    </svg>
  )
}
