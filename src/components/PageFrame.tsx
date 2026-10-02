import type { ReactNode } from 'react'
import { CaptionBox } from '@/components/comic/CaptionBox'
import { usePageTitle } from '@/components/shell/Shell'
import { isSupabaseConfigured } from '@/lib/supabase'

export function BackendNotice() {
  if (isSupabaseConfigured) return null
  return <p role="status">backend not configured</p>
}

export function PageFrame({ title, children }: { title: string; children?: ReactNode }) {
  usePageTitle(title)
  return (
    <main id="main" tabIndex={-1} className="zi-fade mx-auto w-full max-w-[1280px] px-4 py-8 outline-none sm:px-6">
      <CaptionBox compact>
        <h1>{title}</h1>
      </CaptionBox>
      <BackendNotice />
      <div className="mt-6 grid gap-6">{children}</div>
    </main>
  )
}
