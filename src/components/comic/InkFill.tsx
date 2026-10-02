import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

/** Static ink-in: the fill is either fully shown or held back. Motion lands with the hero. */
export function InkFill({ show = true, className, children }: { show?: boolean; className?: string; children?: ReactNode }) {
  return <div className={cn('absolute inset-0', show ? 'opacity-100' : 'opacity-0', className)}>{children}</div>
}
