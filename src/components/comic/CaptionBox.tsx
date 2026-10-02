import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export function CaptionBox({
  tone = 'ivory',
  compact = false,
  className,
  children,
}: {
  tone?: 'ivory' | 'red'
  compact?: boolean
  className?: string
  children?: ReactNode
}) {
  return <div className={cn('zi-cbox', tone === 'red' && 'zi-cbox-red', compact && 'zi-cbox-compact', className)}>{children}</div>
}
