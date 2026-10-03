import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router'
import type { SubmissionRow } from '@/lib/data'
import { SubmissionsPage } from '@/pages/SubmissionsPage'

const TEAM_ID = '00000000-0000-4000-8000-000000000001'

const state = vi.hoisted(() => ({
  rows: [] as unknown[],
  withdraw: vi.fn<(id: string) => Promise<void>>(),
}))

vi.mock('@/lib/auth', () => ({
  useAuth: () => ({ team: { id: '00000000-0000-4000-8000-000000000001' }, isAdmin: false }),
}))
vi.mock('@/lib/supabase', () => ({ isSupabaseConfigured: true, supabase: null }))
vi.mock('@/lib/useLive', () => ({ useSubmissionFeed: () => {} }))
vi.mock('@/lib/data', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/data')>()
  return {
    ...actual,
    fetchSubmissions: async () => state.rows,
    fetchQueueDepth: async () => state.rows.filter((row) => (row as SubmissionRow).status === 'queued').length,
    withdrawSubmission: state.withdraw,
  }
})

function row(id: string, status: string, file_name = `${id}.py`): SubmissionRow {
  return {
    id,
    team_id: TEAM_ID,
    status,
    file_name,
    file_path: `${TEAM_ID}/${id}/search.py`,
    tiebreaker_path: `${TEAM_ID}/${id}/tiebreaker.py`,
    created_at: '2026-10-03T10:00:00Z',
    score: null,
    metrics: null,
    error: null,
  } as unknown as SubmissionRow
}

function renderPage() {
  return render(
    <MemoryRouter>
      <SubmissionsPage />
    </MemoryRouter>,
  )
}

beforeEach(() => {
  state.rows = [row('a', 'queued', 'mine.py'), row('b', 'running'), row('c', 'scored')]
  state.withdraw.mockReset()
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('SubmissionsPage withdraw', () => {
  it('offers Withdraw only on queued rows', async () => {
    renderPage()
    expect(await screen.findByRole('button', { name: 'Withdraw mine.py' })).toBeTruthy()
    expect(screen.getAllByRole('button', { name: /^Withdraw / })).toHaveLength(1)
  })

  it('withdraws after confirmation and reloads the list', async () => {
    const user = userEvent.setup()
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    state.withdraw.mockImplementation(async () => {
      state.rows = state.rows.filter((item) => (item as SubmissionRow).id !== 'a')
    })
    renderPage()
    await user.click(await screen.findByRole('button', { name: 'Withdraw mine.py' }))
    expect(state.withdraw).toHaveBeenCalledWith('a')
    expect((await screen.findByRole('status')).textContent).toMatch(/Withdrew mine\.py/)
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Withdraw mine.py' })).toBeNull())
  })

  it('does nothing when the confirmation is cancelled', async () => {
    const user = userEvent.setup()
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    renderPage()
    await user.click(await screen.findByRole('button', { name: 'Withdraw mine.py' }))
    expect(state.withdraw).not.toHaveBeenCalled()
  })

  it('shows the database refusal when the scorer already took the run', async () => {
    const user = userEvent.setup()
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    state.withdraw.mockRejectedValue(new Error('The scorer already picked this run up, so it can no longer be withdrawn.'))
    renderPage()
    await user.click(await screen.findByRole('button', { name: 'Withdraw mine.py' }))
    expect((await screen.findByRole('alert')).textContent).toMatch(/already picked this run up/)
  })
})
