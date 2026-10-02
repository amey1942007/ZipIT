import { cn } from '@/lib/utils'

export function PathMeter({ filled, total = 7, label = 'PATH', readout }: { filled: number; total?: number; label?: string; readout: string }) {
  return (
    <div aria-hidden className="flex items-center gap-2 font-mono text-xs font-bold tracking-[0.08em] text-gold">
      <span>{label}</span>
      <span className="flex gap-[3px]">
        {Array.from({ length: total }, (_, index) => (
          <i
            key={index}
            className={cn(
              'block h-3 w-[22px] -skew-x-[20deg]',
              index < filled ? 'bg-gold' : 'bg-gold/15 shadow-[inset_0_0_0_1px_rgba(255,200,61,.5)]',
            )}
          />
        ))}
      </span>
      <span className="tabular-nums">{readout}</span>
    </div>
  )
}
