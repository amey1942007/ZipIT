import type { ZipPuzzle } from '@/lib/zip/types'
import { BOARD_PAD, polylinePoints } from '@/arena/boardGeometry'

export function ZipBoard({
  puzzle,
  path,
  backtracked,
  head,
  cell,
  showLine,
}: {
  puzzle: ZipPuzzle
  path: number[]
  backtracked: number[]
  head: number | null
  cell: number
  showLine: boolean
}) {
  const onPath = new Set(path)
  const popped = new Set(backtracked)
  const walls = new Set(puzzle.walls)
  const numbers = new Map(puzzle.waypoints.map((index, order) => [index, order + 1]))
  const walled = (a: number, b: number) => walls.has(a < b ? `${a}|${b}` : `${b}|${a}`)
  const width = puzzle.cols * cell
  const height = puzzle.rows * cell
  const points = showLine && path.length > 1 ? polylinePoints(path, puzzle.cols, cell) : []
  const headRow = head == null ? null : Math.floor(head / puzzle.cols)
  const headCol = head == null ? null : head % puzzle.cols

  return (
    <div className="shrink-0" style={{ padding: BOARD_PAD, width: width + BOARD_PAD * 2 }}>
      <div className="relative" style={{ width, height }} role="img" aria-label={`${puzzle.rows} by ${puzzle.cols} Zip board`}>
        <div
          className="absolute inset-0 grid bg-cell"
          style={{ gridTemplateColumns: `repeat(${puzzle.cols}, ${cell}px)`, gridTemplateRows: `repeat(${puzzle.rows}, ${cell}px)` }}
        >
          {Array.from({ length: puzzle.rows * puzzle.cols }, (_, index) => {
            const row = Math.floor(index / puzzle.cols)
            const col = index % puzzle.cols
            return (
              <div
                key={index}
                className="box-border"
                style={{
                  width: cell,
                  height: cell,
                  background: onPath.has(index)
                    ? 'var(--zi-cell-visited)'
                    : popped.has(index)
                      ? 'var(--zi-cell-backtracked)'
                      : 'var(--zi-cell)',
                  borderRight:
                    col < puzzle.cols - 1 && walled(index, index + 1) ? '3px solid var(--zi-wall)' : '1px solid var(--zi-cell-line)',
                  borderBottom:
                    row < puzzle.rows - 1 && walled(index, index + puzzle.cols)
                      ? '3px solid var(--zi-wall)'
                      : '1px solid var(--zi-cell-line)',
                }}
              />
            )
          })}
        </div>
        {points.length > 1 ? (
          <svg className="absolute inset-0 z-[1]" width={width} height={height} aria-hidden>
            <polyline
              points={points.map((point) => point.join(',')).join(' ')}
              fill="none"
              stroke="var(--zi-path)"
              strokeWidth={cell * 0.3}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        ) : null}
        <div className="pointer-events-none absolute inset-0 z-[2]">
          {puzzle.waypoints.map((index) => {
            const row = Math.floor(index / puzzle.cols)
            const col = index % puzzle.cols
            const disc = Math.round(cell * 0.62)
            return (
              <span
                key={index}
                className="absolute grid place-items-center rounded-full bg-gold font-bold text-on-gold"
                style={{
                  width: disc,
                  height: disc,
                  left: col * cell + cell / 2,
                  top: row * cell + cell / 2,
                  transform: 'translate(-50%, -50%)',
                  fontSize: Math.max(12, Math.round(cell * 0.28)),
                }}
              >
                {numbers.get(index)}
              </span>
            )
          })}
        </div>
        {headRow != null && headCol != null ? (
          <span
            className="pointer-events-none absolute z-[3] rounded-full border-primary bg-white"
            style={{
              width: Math.round(cell * 0.34),
              height: Math.round(cell * 0.34),
              left: headCol * cell + cell / 2,
              top: headRow * cell + cell / 2,
              transform: 'translate(-50%, -50%)',
              borderWidth: Math.max(2, Math.round(cell * 0.06)),
              background: 'var(--zi-head-fill)',
              borderColor: 'var(--zi-head-ring)',
            }}
            aria-hidden
          />
        ) : null}
      </div>
    </div>
  )
}
