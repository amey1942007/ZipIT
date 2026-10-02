import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import App from '@/App'
import { isSupabaseConfigured, supabase } from '@/lib/supabase'

const pages: Array<[hash: string, title: string | RegExp]> = [
  ['#/login', 'Login'],
  ['#/', /Zip it/],
  ['#/profile', 'Profile'],
  ['#/submissions', 'Submissions'],
  ['#/leaderboard', 'Leaderboard'],
  ['#/arena', 'Arena'],
  ['#/admin/teams', 'Admin'],
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

  it('keeps admin nav read-only and redirects a removed Scores link', async () => {
    window.location.hash = '#/admin/scores'
    render(<App />)
    const nav = await screen.findByRole('navigation', { name: 'Admin' })
    expect(nav).toHaveTextContent('Teams')
    expect(nav).toHaveTextContent('Submissions')
    expect(nav).toHaveTextContent('Leaderboard')
    expect(nav).toHaveTextContent('Audit')
    expect(nav).not.toHaveTextContent('Scores')
    expect(screen.getByText('The admin page has no write actions; the site is view-only for the admin.')).toBeInTheDocument()
    expect(screen.getByLabelText('Search')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /freeze/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /create/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /delete/i })).not.toBeInTheDocument()
    await waitFor(() => {
      expect(window.location.hash).toBe('#/admin/teams')
    })
  })

  it('renders the comic 404 for an unknown route', () => {
    window.location.hash = '#/no-such-page'
    render(<App />)
    expect(screen.getByRole('heading', { name: 'Page not found' })).toBeInTheDocument()
    expect(screen.getByText("That page doesn't exist.")).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Go home' })).toHaveAttribute('href', '#/')
  })

  it('shows Live on the admin leaderboard without a freeze control', async () => {
    window.location.hash = '#/admin/leaderboard'
    render(<App />)
    expect(await screen.findByText('Live')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /freeze/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /reveal/i })).not.toBeInTheDocument()
  })
})
