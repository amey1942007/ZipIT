import { cn } from '@/lib/utils'

export function CheckChip({ label, state = 'idle' }: { label: string; state?: 'idle' | 'ok' | 'bad' }) {
  return (
    <span className={cn('zi-chip', state === 'ok' && 'text-ink', state === 'bad' && 'bg-comic-red')}>
      <span aria-hidden>{state === 'ok' ? '✓' : state === 'bad' ? '✗' : '·'}</span>
      {label}
    </span>
  )
}
