import { useState, type MouseEvent, type ReactNode } from 'react'
import { Link } from 'react-router'
import { StampOverlay } from '@/components/comic/BurstPortal'
import { LockOn } from '@/components/comic/LockOn'
import { Sfx } from '@/components/comic/Sfx'
import { cn } from '@/lib/utils'

type Variant = 'primary' | 'danger' | 'ghost'
type Size = 'default' | 'hero'

const VARIANT = {
  primary: 'zi-abtn-primary',
  danger: 'zi-abtn-danger',
  ghost: 'zi-abtn-ghost',
} as const

function reducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

function armClick(event: MouseEvent<HTMLElement>, setTick: (value: number | ((n: number) => number)) => void) {
  if (reducedMotion()) return
  const el = event.currentTarget
  el.classList.remove('zi-squash')
  void el.offsetWidth
  el.classList.add('zi-squash')
  setTick((n) => n + 1)
}

export function ActionButton({
  variant = 'primary',
  size = 'default',
  to,
  sfx = 'click',
  className,
  children,
  type = 'button',
  ...rest
}: {
  variant?: Variant
  size?: Size
  to?: string
  sfx?: 'click' | 'go'
  className?: string
  children?: ReactNode
  type?: 'button' | 'submit'
} & Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'type' | 'children' | 'className'>) {
  const [tick, setTick] = useState(0)
  const classes = cn('zi-abtn relative', VARIANT[variant], size === 'hero' && 'zi-abtn-hero', className)
  const burst =
    sfx === 'go' && tick > 0 ? (
      <StampOverlay>
        <span key={tick} className="zi-burst-xl">
          <Sfx preset="go" stamp={false} play holdMs={700} label="GO!" />
        </span>
      </StampOverlay>
    ) : null
  if (to) {
    return (
      <Link
        to={to}
        className={classes}
        onClick={(event) => {
          rest.onClick?.(event as unknown as MouseEvent<HTMLButtonElement>)
          armClick(event, setTick)
        }}
      >
        {children}
        <LockOn />
        {burst}
      </Link>
    )
  }
  return (
    <button
      type={type}
      className={classes}
      {...rest}
      onClick={(event) => {
        rest.onClick?.(event)
        armClick(event, setTick)
      }}
    >
      {children}
      <LockOn />
      {burst}
    </button>
  )
}
