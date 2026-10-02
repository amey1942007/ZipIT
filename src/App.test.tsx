import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import App from '@/App'
import { isSupabaseConfigured, supabase } from '@/lib/supabase'

const pages: Array<[hash: string, title: string]> = [
  ['#/login', 'Login'],
  ['#/', 'Home'],
  ['#/profile', 'Profile'],
  ['#/submissions', 'Submissions'],
  ['#/leaderboard', 'Leaderboard'],
  ['#/arena', 'Arena'],
  ['#/admin', 'Admin'],
]

describe('foundation', () => {
  afterEach(() => {
    cleanup()
  })

  it('keeps the app up when the Supabase env is absent', () => {
    expect(isSupabaseConfigured).toBe(false)
    expect(supabase).toBeNull()
  })

  it.each(pages)('renders %s', (hash, title) => {
    window.location.hash = hash
    render(<App />)
    expect(screen.getByRole('heading', { name: title })).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('backend not configured')
  })
})
