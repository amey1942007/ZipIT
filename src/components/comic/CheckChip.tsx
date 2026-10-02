import { cn } from '@/lib/utils'

export function CheckChip({ label, state = 'idle', delay = 0 }: { label: string; state?: 'idle' | 'ok' | 'bad'; delay?: number }) {
  return (
    <span className={cn('zi-chip', state === 'ok' && 'zi-chip-ok text-ink', state === 'bad' && 'bg-comic-red')} style={{ animationDelay: `${delay}ms` }}>
      <span aria-hidden>{state === 'ok' ? '✓' : state === 'bad' ? '✗' : '·'}</span>
      {label}
    </span>
  )
}
