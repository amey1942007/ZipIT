export function ImpactLines({ compact = false }: { compact?: boolean }) {
  const rx = compact ? 70 : 95
  const ry = compact ? 22 : 30
  const count = 14
  return (
    <svg aria-hidden width={rx * 2} height={ry * 2} viewBox={`${-rx} ${-ry} ${rx * 2} ${ry * 2}`} className="overflow-visible">
      {Array.from({ length: count }, (_, index) => {
        const angle = (index / count) * Math.PI * 2
        const inner = 0.72
        const outer = 1
        return (
          <line
            key={index}
            x1={Math.cos(angle) * rx * inner}
            y1={Math.sin(angle) * ry * inner}
            x2={Math.cos(angle) * rx * outer}
            y2={Math.sin(angle) * ry * outer}
            stroke="var(--zi-ink)"
            strokeWidth={3}
            strokeLinecap="round"
          />
        )
      })}
    </svg>
  )
}
