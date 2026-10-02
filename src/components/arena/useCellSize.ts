import { useEffect, useState, type RefObject } from 'react'
import { cellSize, type BoardBreakpoint } from '@/arena/boardGeometry'

const GAP = 24

function breakpoint(): BoardBreakpoint {
  return window.matchMedia('(min-width: 1024px)').matches ? 'desktop' : 'mobile'
}

/** Measure the full row, then reserve the controls column on desktop so the board cannot stretch. */
export function useCellSize(
  cols: number,
  rowRef: RefObject<HTMLDivElement | null>,
  controlsRef: RefObject<HTMLDivElement | null>,
): number {
  const [cell, setCell] = useState(() => cellSize(cols, 'desktop', 1200))

  useEffect(() => {
    const row = rowRef.current
    if (!row) return
    const measure = () => {
      const bp = breakpoint()
      const controls = bp === 'desktop' ? (controlsRef.current?.offsetWidth ?? 0) + GAP : 0
      const available = row.clientWidth > 0 ? row.clientWidth - controls : bp === 'desktop' ? 1200 : 358
      setCell(cellSize(cols, bp, Math.max(available, 0)))
    }
    measure()
    const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(measure) : null
    observer?.observe(row)
    if (controlsRef.current) observer?.observe(controlsRef.current)
    window.addEventListener('resize', measure)
    return () => {
      observer?.disconnect()
      window.removeEventListener('resize', measure)
    }
  }, [cols, rowRef, controlsRef])

  return cell
}
