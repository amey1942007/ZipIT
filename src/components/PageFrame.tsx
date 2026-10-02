import type { ReactNode } from 'react'
import { CaptionBox } from '@/components/comic/CaptionBox'
import { usePageTitle } from '@/components/shell/Shell'
import { isSupabaseConfigured } from '@/lib/supabase'

export function BackendNotice() {
  if (isSupabaseConfigured) return null
  return <p role="status">backend not configured</p>
}

export function PageFrame({ title, children, bare = false }: { title: string; children?: ReactNode; bare?: boolean }) {
  usePageTitle(title)
  return (
    <main id="main" tabIndex={-1} className="mx-auto w-full max-w-[1280px] px-4 py-8 outline-none sm:px-6">
      {bare ? null : (
        <CaptionBox compact>
          <h1 tabIndex={-1}>{title}</h1>
        </CaptionBox>
      )}
      <BackendNotice />
      <div className={bare ? 'grid gap-6' : 'mt-6 grid gap-6'}>{children}</div>
    </main>
  )
}
