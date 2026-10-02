import { HudReadout } from '@/components/comic/HudReadout'
import { cn } from '@/lib/utils'

export function SkeletonPanel({ label = 'LOADING…', className }: { label?: string; className?: string }) {
  return (
    <div className={cn('zi-skeleton zi-shimmer grid place-items-center', className)}>
      <HudReadout>{label}</HudReadout>
    </div>
  )
}
