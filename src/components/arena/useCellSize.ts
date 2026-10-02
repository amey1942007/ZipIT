import { useEffect, useState } from 'react'
import { BOARD_PAD, CELL_MIN } from '@/arena/boardGeometry'

/** Fit the board to the square slot. The slot width is the column, not the playback panel. */
export function useCellSize(cols: number, board: HTMLElement | null): number {
  const [cell, setCell] = useState(() => CELL_MIN)

  useEffect(() => {
    if (!board) return
    const measure = () => {
      const available = board.clientWidth
      const fit = Math.floor((available - 2 * BOARD_PAD - 6) / Math.max(1, cols))
      setCell(Math.max(CELL_MIN, Number.isFinite(fit) ? fit : CELL_MIN))
    }
    measure()
    const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(measure) : null
    observer?.observe(board)
    window.addEventListener('resize', measure)
    return () => {
      observer?.disconnect()
      window.removeEventListener('resize', measure)
    }
  }, [cols, board])

  return cell
}
