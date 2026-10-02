import type { ZipPuzzle } from '@/lib/zip/types'

export function ZipBoard({
  puzzle,
  path,
  backtracked,
  head,
}: {
  puzzle: ZipPuzzle
  path: number[]
  backtracked: number[]
  head: number | null
}) {
  const onPath = new Set(path)
  const popped = new Set(backtracked)
  const walls = new Set(puzzle.walls)
  const numbers = new Map(puzzle.waypoints.map((cell, index) => [cell, index + 1]))
  const walled = (a: number, b: number) => walls.has(a < b ? `${a}|${b}` : `${b}|${a}`)

  return (
    <div
      className="grid w-full max-w-[440px] border border-cell-line bg-cell"
      style={{ gridTemplateColumns: `repeat(${puzzle.cols}, minmax(0, 1fr))`, aspectRatio: `${puzzle.cols} / ${puzzle.rows}` }}
      role="img"
      aria-label={`${puzzle.rows} by ${puzzle.cols} Zip board`}
    >
      {Array.from({ length: puzzle.rows * puzzle.cols }, (_, cell) => {
        const row = Math.floor(cell / puzzle.cols)
        const col = cell % puzzle.cols
        const number = numbers.get(cell)
        return (
          <div
            key={cell}
            className="relative grid place-items-center border-cell-line text-xs font-bold"
            style={{
              background: onPath.has(cell) ? 'var(--zi-cell-visited)' : popped.has(cell) ? 'var(--zi-cell-backtracked)' : 'var(--zi-cell)',
              borderRight: col < puzzle.cols - 1 && walled(cell, cell + 1) ? '3px solid var(--zi-wall)' : '1px solid var(--zi-cell-line)',
              borderBottom: row < puzzle.rows - 1 && walled(cell, cell + puzzle.cols) ? '3px solid var(--zi-wall)' : '1px solid var(--zi-cell-line)',
              outline: head === cell ? '2px solid var(--zi-head-ring)' : undefined,
              outlineOffset: head === cell ? -3 : undefined,
            }}
          >
            {number ? (
              <span className="grid size-5 place-items-center rounded-full bg-gold text-[10px] text-on-gold">{number}</span>
            ) : null}
          </div>
        )
      })}
    </div>
  )
}
