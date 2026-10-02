import { useId } from 'react'
import { BOARD_PAD, polylinePoints } from '@/arena/boardGeometry'
import type { ZipPuzzle } from '@/lib/zip/types'

export function ZipBoard({
  puzzle,
  path,
  backtracked,
  head,
  cell,
  showLine,
  playing = false,
}: {
  puzzle: ZipPuzzle
  path: number[]
  backtracked: number[]
  head: number | null
  cell: number
  showLine: boolean
  playing?: boolean
}) {
  const hatchId = `zi-hatch-${useId().replace(/:/g, '')}`
  const onPath = new Set(path)
  const popped = new Set(backtracked)
  const numbers = new Map(puzzle.waypoints.map((index, order) => [index, order + 1]))
  const nextWaypoint = puzzle.waypoints.find((index) => !onPath.has(index)) ?? null
  const width = puzzle.cols * cell
  const height = puzzle.rows * cell
  const points = showLine && path.length > 1 ? polylinePoints(path, puzzle.cols, cell) : []
  const wallWidth = Math.max(4, cell * 0.08)
  const fontSize = Math.max(12, cell * 0.36)

  const walls = puzzle.walls.flatMap((wall) => {
    const [left, right] = wall.split('|').map(Number)
    if (left == null || right == null || Number.isNaN(left) || Number.isNaN(right)) return []
    const a = Math.min(left, right)
    const b = Math.max(left, right)
    const row = Math.floor(a / puzzle.cols)
    const col = a % puzzle.cols
    if (b === a + 1 && Math.floor(b / puzzle.cols) === row) {
      return [{ x1: (col + 1) * cell, y1: row * cell, x2: (col + 1) * cell, y2: (row + 1) * cell, key: wall }]
    }
    if (b === a + puzzle.cols) {
      return [{ x1: col * cell, y1: (row + 1) * cell, x2: (col + 1) * cell, y2: (row + 1) * cell, key: wall }]
    }
    return []
  })

  return (
    <div
      className="shrink-0 border-2"
      style={{
        boxSizing: 'content-box',
        padding: BOARD_PAD,
        width,
        background: 'var(--zi-board-surface)',
        borderColor: 'var(--zi-board-frame)',
        borderRadius: 12,
      }}
    >
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={`${puzzle.rows} by ${puzzle.cols} Zip board`}
      >
        <defs>
          <pattern id={hatchId} width="6" height="6" patternUnits="userSpaceOnUse">
            <line x1="0" y1="6" x2="6" y2="0" stroke="var(--zi-backtrack-hatch)" strokeWidth="1" />
          </pattern>
        </defs>
        {Array.from({ length: puzzle.rows * puzzle.cols }, (_, index) => {
          const row = Math.floor(index / puzzle.cols)
          const col = index % puzzle.cols
          return (
            <rect
              key={index}
              x={col * cell}
              y={row * cell}
              width={cell}
              height={cell}
              rx={4}
              fill="var(--zi-cell)"
            />
          )
        })}
        {Array.from(onPath, (index) => {
          const row = Math.floor(index / puzzle.cols)
          const col = index % puzzle.cols
          return (
            <rect
              key={`v-${index}`}
              x={col * cell}
              y={row * cell}
              width={cell}
              height={cell}
              rx={4}
              fill="var(--zi-cell-visited)"
            />
          )
        })}
        {Array.from(popped, (index) => {
          const row = Math.floor(index / puzzle.cols)
          const col = index % puzzle.cols
          return (
            <rect
              key={`b-${index}`}
              x={col * cell}
              y={row * cell}
              width={cell}
              height={cell}
              rx={4}
              fill={`url(#${hatchId})`}
            />
          )
        })}
        {Array.from({ length: puzzle.cols - 1 }, (_, col) => (
          <line
            key={`gv-${col}`}
            x1={(col + 1) * cell}
            y1={0}
            x2={(col + 1) * cell}
            y2={height}
            stroke="var(--zi-grid-line)"
            strokeWidth={1}
          />
        ))}
        {Array.from({ length: puzzle.rows - 1 }, (_, row) => (
          <line
            key={`gh-${row}`}
            x1={0}
            y1={(row + 1) * cell}
            x2={width}
            y2={(row + 1) * cell}
            stroke="var(--zi-grid-line)"
            strokeWidth={1}
          />
        ))}
        {walls.map((wall) => (
          <line
            key={wall.key}
            x1={wall.x1}
            y1={wall.y1}
            x2={wall.x2}
            y2={wall.y2}
            stroke="var(--zi-wall)"
            strokeWidth={wallWidth}
            strokeLinecap="round"
          />
        ))}
        {points.length > 1 ? (
          <polyline
            points={points.map((point) => point.join(',')).join(' ')}
            fill="none"
            stroke="var(--zi-path)"
            strokeWidth={cell * 0.3}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ) : null}
        {puzzle.waypoints.map((index) => {
          const row = Math.floor(index / puzzle.cols)
          const col = index % puzzle.cols
          const cx = col * cell + cell / 2
          const cy = row * cell + cell / 2
          const reached = onPath.has(index)
          return (
            <g key={`wp-${index}`}>
              <circle
                cx={cx}
                cy={cy}
                r={cell * 0.3}
                fill={reached ? 'var(--zi-wp-reached-fill)' : 'var(--zi-wp-fill)'}
                stroke={reached ? 'var(--zi-wp-reached-stroke)' : 'var(--zi-wp-stroke)'}
                strokeWidth={2}
              />
              <text
                x={cx}
                y={cy}
                textAnchor="middle"
                dominantBaseline="central"
                fill={reached ? 'var(--zi-wp-reached-num)' : 'var(--zi-wp-num)'}
                fontFamily="var(--zi-font-mono)"
                fontWeight={700}
                fontSize={fontSize}
              >
                {numbers.get(index)}
              </text>
            </g>
          )
        })}
        {nextWaypoint != null ? (
          <circle
            className="zi-ring-spin"
            cx={(nextWaypoint % puzzle.cols) * cell + cell / 2}
            cy={Math.floor(nextWaypoint / puzzle.cols) * cell + cell / 2}
            r={cell * 0.42}
            fill="none"
            stroke="var(--zi-next-wp-ring)"
            strokeWidth={2}
            strokeDasharray="4 4"
            style={{ transformBox: 'fill-box', transformOrigin: 'center' }}
          />
        ) : null}
        {head != null ? (
          <g>
            <circle
              className={playing ? 'zi-head-pulse' : undefined}
              cx={(head % puzzle.cols) * cell + cell / 2}
              cy={Math.floor(head / puzzle.cols) * cell + cell / 2}
              r={cell * 0.34}
              fill="var(--zi-head-halo)"
            />
            <circle
              cx={(head % puzzle.cols) * cell + cell / 2}
              cy={Math.floor(head / puzzle.cols) * cell + cell / 2}
              r={cell * 0.22}
              fill="var(--zi-head-fill)"
              stroke="var(--zi-head-ring)"
              strokeWidth={3}
            />
          </g>
        ) : null}
      </svg>
    </div>
  )
}
