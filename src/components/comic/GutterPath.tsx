function jagged(d: string): string {
  const nums = d.match(/-?\d+(?:\.\d+)?/g)
  if (!nums || nums.length < 4) return d
  const pts: [number, number][] = []
  for (let i = 0; i + 1 < nums.length; i += 2) pts.push([Number(nums[i]), Number(nums[i + 1])])
  let out = `M${pts[0]![0].toFixed(1)} ${pts[0]![1].toFixed(1)}`
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0] = pts[i - 1]!
    const [x1, y1] = pts[i]!
    const dx = x1 - x0
    const dy = y1 - y0
    const len = Math.hypot(dx, dy) || 1
    const steps = Math.max(1, Math.round(len / 36))
    for (let step = 1; step <= steps; step++) {
      const t = step / steps
      const amp = step === steps ? 0 : (step % 2 === 0 ? 1 : -1) * Math.min(7, len * 0.12)
      const x = x0 + dx * t + (-dy / len) * amp
      const y = y0 + dy * t + (dx / len) * amp
      out += ` L${x.toFixed(1)} ${y.toFixed(1)}`
    }
  }
  return out
}

export function GutterPath({
  d,
  progress = 1,
  bolt = false,
}: {
  d: string
  progress?: number
  bolt?: boolean
}) {
  const offset = 1 - progress
  const shared = {
    fill: 'none' as const,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    pathLength: 1,
    strokeDasharray: '1 1',
    strokeDashoffset: offset,
  }
  if (!bolt) {
    return (
      <svg className="zi-login-path pointer-events-none absolute inset-0 h-full w-full overflow-visible" aria-hidden>
        <path d={d} {...shared} stroke="var(--zi-gold-c)" strokeWidth="var(--zi-path-edge-w)" />
        <path d={d} {...shared} stroke="var(--zi-red-c)" strokeWidth="var(--zi-path-core-w)" />
      </svg>
    )
  }
  return (
    <svg className="zi-zip pointer-events-none absolute inset-0 z-[1] h-full w-full overflow-visible" aria-hidden>
      <path d={d} {...shared} className="zi-zip-glow" stroke="#FFC83D" strokeWidth="18" />
      <path
        d={jagged(d)}
        fill="none"
        stroke="#FFF6E8"
        strokeWidth="5"
        strokeLinecap="round"
        strokeLinejoin="round"
        pathLength={1}
        strokeDashoffset={offset}
        className={progress >= 0.999 ? 'zi-zip-bolt zi-zip-live' : 'zi-zip-bolt'}
      />
      <path d={d} {...shared} className="zi-zip-core" stroke="#FFF6E8" strokeWidth="4" />
    </svg>
  )
}
