import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export function Balloon({
  tail = 'bl',
  className,
  children,
}: {
  tail?: 'bl' | 'br' | 'none'
  className?: string
  children?: ReactNode
}) {
  return (
    <div className={cn('zi-balloon', className)}>
      {children}
      {tail === 'none' ? null : <span aria-hidden className={cn('zi-balloon-tail', tail === 'bl' ? 'zi-balloon-tail-bl' : 'zi-balloon-tail-br')} />}
    </div>
  )
}
