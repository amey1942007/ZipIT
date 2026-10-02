import { isSupabaseConfigured } from '@/lib/supabase'

export function StubPage({ title }: { title: string }) {
  return (
    <main>
      <h1>{title}</h1>
      {isSupabaseConfigured ? null : (
        <p role="status">backend not configured</p>
      )}
    </main>
  )
}
