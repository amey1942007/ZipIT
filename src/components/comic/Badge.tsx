import { cn } from '@/lib/utils'

export function Badge({ n, reached = false, className }: { n: number; reached?: boolean; className?: string }) {
  return (
    <span aria-hidden className={cn('zi-badge', reached && 'zi-badge-reached', className)}>
      {n}
    </span>
  )
}
