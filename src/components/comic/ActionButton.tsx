import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { cn } from '@/lib/utils'

type Variant = 'primary' | 'danger' | 'ghost'
type Size = 'default' | 'hero'

const VARIANT = {
  primary: 'zi-abtn-primary',
  danger: 'zi-abtn-danger',
  ghost: 'zi-abtn-ghost',
} as const

export function ActionButton({
  variant = 'primary',
  size = 'default',
  to,
  className,
  children,
  type = 'button',
  ...rest
}: {
  variant?: Variant
  size?: Size
  to?: string
  className?: string
  children?: ReactNode
  type?: 'button' | 'submit'
} & Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'type' | 'children' | 'className'>) {
  const classes = cn('zi-abtn', VARIANT[variant], size === 'hero' && 'zi-abtn-hero', className)
  if (to) {
    return (
      <Link to={to} className={classes}>
        {children}
      </Link>
    )
  }
  return (
    <button type={type} className={classes} {...rest}>
      {children}
    </button>
  )
}
