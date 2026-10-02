import { Link } from 'react-router'
import { cn } from '@/lib/utils'

export function ComicTabs({
  label = 'Admin sections',
  tabs,
  current,
}: {
  label?: string
  tabs: Array<{ to: string; label: string }>
  current: string
}) {
  return (
    <nav aria-label={label} className="flex flex-wrap gap-2">
      {tabs.map((tab) => {
        const active = tab.to === current
        return (
          <Link key={tab.to} to={tab.to} aria-current={active ? 'page' : undefined} className={cn('zi-tab', active ? 'zi-tab-active' : 'zi-tab-idle')}>
            {tab.label}
          </Link>
        )
      })}
    </nav>
  )
}
