import type { ReactNode } from 'react'
import { ActionButton } from '@/components/comic/ActionButton'
import { CaptionBox } from '@/components/comic/CaptionBox'
import { Panel } from '@/components/comic/Panel'

export function EmptyPanel({
  title,
  body,
  actionLabel,
  actionTo,
}: {
  title: string
  body?: string
  actionLabel?: string
  actionTo?: string
}) {
  let action: ReactNode = null
  if (actionLabel && actionTo) {
    action = (
      <ActionButton to={actionTo} className="mt-4">
        {actionLabel}
      </ActionButton>
    )
  }
  return (
    <Panel fill="ivory" ghost="0" className="p-6">
      <CaptionBox>
        <h2>{title}</h2>
        {body ? <p>{body}</p> : null}
      </CaptionBox>
      {action}
    </Panel>
  )
}
