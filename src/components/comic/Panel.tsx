import type { ElementType, ReactNode } from 'react'
import { LockOn } from '@/components/comic/LockOn'
import { cn } from '@/lib/utils'

const FILLS = {
  ivory: 'ht-ivory',
  'ivory-red': 'ht-ivory-red',
  red: 'ht-red',
  gold: 'ht-gold',
  maroon: 'ht-maroon',
  deep: 'ht-deep',
  plain: 'bg-comic-maroon',
} as const

export type PanelFill = keyof typeof FILLS

export function Panel({
  fill,
  ghost,
  inked = true,
  as: Tag = 'div',
  className,
  children,
}: {
  fill: PanelFill
  index?: number
  ghost?: string
  inked?: boolean
  as?: ElementType
  className?: string
  children?: ReactNode
}) {
  const paint = FILLS[fill]
  return (
    <Tag className={cn('zi-panel', className)}>
      {inked ? null : (
        <div className="base" aria-hidden>
          <div className={cn('absolute inset-0', paint)} />
          <div className="absolute inset-0 bg-ink/80" />
        </div>
      )}
      <div className={cn('fill', paint, inked ? 'opacity-100' : 'opacity-0')} />
      {ghost ? (
        <span className="ghost" aria-hidden>
          {ghost}
        </span>
      ) : null}
      <div className={cn('content', inked ? 'opacity-100' : 'opacity-[.22]')}>{children}</div>
      <div className={cn('edge', inked ? 'opacity-100' : 'opacity-0')} />
      <LockOn />
    </Tag>
  )
}
