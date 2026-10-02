import type { CSSProperties } from 'react'
import { burstPoints, pointsAttr, speedLines } from '@/components/comic/sfxGeometry'

const PRESETS = {
  zipit: { text: 'ZIP IT!', sub: 'PATH COMPLETE', seed: 3, desktop: [120, 150], tablet: [96, 120], mobile: [64, 80] },
  zipped: { text: 'ZIPPED!', sub: 'QUEUED', seed: 23, desktop: [104, 130], tablet: [84, 105], mobile: [60, 74] },
  arena: { text: 'ZIP IT!', sub: 'SOLVED', seed: 3, desktop: [72, 90], tablet: [64, 80], mobile: [48, 60] },
  click: { text: 'CLICK!', sub: '', seed: 11, desktop: [44, 54], tablet: [44, 54], mobile: [36, 44] },
  go: { text: 'GO!', sub: '', seed: 17, desktop: [40, 50], tablet: [40, 50], mobile: [32, 40] },
  new1: { text: 'NEW #1!', sub: '', seed: 29, desktop: [44, 54], tablet: [40, 50], mobile: [32, 40] },
  newbest: { text: 'NEW BEST!', sub: '', seed: 31, desktop: [40, 50], tablet: [34, 42], mobile: [28, 36] },
} as const

export type SfxPreset = keyof typeof PRESETS

export function Sfx({
  preset,
  stamp = true,
  play = false,
  holdMs = 570,
  label,
}: {
  preset: SfxPreset
  stamp?: boolean
  /** Slam in, hold, then pop out. Timings match concept `sfxAt` (180ms in, 200ms out). */
  play?: boolean
  holdMs?: number
  label?: string
}) {
  const spec = PRESETS[preset]
  const [fs, R] = spec.desktop
  const burst = burstPoints(spec.seed, R)
  const star = burstPoints(spec.seed, R, [0.74, 0], [0.5, 0])
  const lines = stamp ? [] : speedLines(spec.seed, R)
  const motion = play && !stamp
  const pad = R * 3.4
  const size = pad * 2
  return (
    <span
      className={stamp ? 'zi-sfx zi-sfx-stamp inline-block' : motion ? 'zi-sfx zi-sfx-play inline-block' : 'zi-sfx inline-block'}
      style={motion ? ({ '--zi-sfx-hold': `${holdMs}ms` } as CSSProperties) : undefined}
    >
      <svg
        aria-hidden="true"
        width={size}
        height={size}
        viewBox={`${-pad} ${-pad} ${size} ${size}`}
        className="overflow-visible"
      >
        {lines.map((line, index) => (
          <line
            key={index}
            x1={line.x1}
            y1={line.y1}
            x2={line.x2}
            y2={line.y2}
            stroke={line.color}
            strokeWidth={line.width}
            strokeLinecap="round"
          />
        ))}
        <polygon points={pointsAttr(burst)} fill="var(--zi-burst-fill)" stroke="var(--zi-burst-stroke)" strokeWidth={7} strokeLinejoin="round" />
        <polygon points={pointsAttr(star)} fill="none" stroke="var(--zi-gold-c)" strokeWidth={3} strokeLinejoin="round" />
        <g transform={`rotate(-7) skewX(-14)`}>
          <text
            x={fs * 0.075}
            y={fs * 0.075}
            fill="var(--zi-sfx-shadow)"
            stroke="var(--zi-sfx-shadow)"
            strokeWidth={fs * 0.16}
            fontFamily="Chakra Petch"
            fontWeight={700}
            fontSize={fs}
            textAnchor="middle"
            dominantBaseline="central"
            letterSpacing="2"
          >
            {spec.text}
          </text>
          <text
            x={0}
            y={0}
            fill="var(--zi-sfx-fill)"
            stroke="var(--zi-sfx-stroke)"
            strokeWidth={fs * 0.13}
            paintOrder="stroke"
            fontFamily="Chakra Petch"
            fontWeight={700}
            fontSize={fs}
            textAnchor="middle"
            dominantBaseline="central"
            letterSpacing="2"
          >
            {spec.text}
          </text>
          {spec.sub ? (
            <text
              x={0}
              y={fs * 0.72}
              fill="var(--zi-ivory)"
              fontFamily="JetBrains Mono"
              fontWeight={700}
              fontSize={fs * 0.17}
              textAnchor="middle"
              letterSpacing="3"
            >
              {spec.sub}
            </text>
          ) : null}
        </g>
      </svg>
      {label ? <span className="sr-only">{label}</span> : null}
    </span>
  )
}
