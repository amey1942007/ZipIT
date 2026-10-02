import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export function HudReadout({ className, children }: { className?: string; children?: ReactNode }) {
  return <span className={cn('zi-tm', className)}>{children}</span>
}
