import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export function PanelGrid({ className, children }: { className?: string; children?: ReactNode }) {
  return <div className={cn('relative grid gap-gutter', className)}>{children}</div>
}
