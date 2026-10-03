import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router'
import type { CheckResult } from '@/arena/engineCore'
import type { SubmissionRow } from '@/lib/data'
import { SubmissionsPage } from '@/pages/SubmissionsPage'
import { SEARCH_TEMPLATE } from '@/playground/templates'

const TEAM_ID = '00000000-0000-4000-8000-000000000001'

const state = vi.hoisted(() => ({
  rows: [] as unknown[],
  withdraw: vi.fn<(id: string) => Promise<void>>(),
  upload: vi.fn<(...args: unknown[]) => Promise<unknown>>(),
  checks: [] as unknown[],
  checked: [] as { search: string; tiebreaker: string }[],
}))

vi.mock('@/arena/engine', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/arena/engine')>()
  class FakeEngineClient {
    async check(code: { search: string; tiebreaker: string }) {
      state.checked.push(code)
      return { checks: state.checks, error: null }
    }
    dispose() {}
  }
  return { ...actual, EngineClient: FakeEngineClient }
})

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
    uploadSubmission: state.upload,
  }
})

const ALL_OK: CheckResult[] = ['syntax', 'imports', 'classes', 'output', 'smoke'].map((id) => ({
  id: id as CheckResult['id'],
  ok: true,
  message: '',
}))
const SEARCH_CODE = 'class Score:\n    def score(self, node, board):\n        return node.depth\n'
const TIEBREAKER_CODE = 'class TieBreaker:\n    def key(self, node, board):\n        return (node.head,)\n'

function py(name: string, text: string) {
  return new File([text], name, { type: 'text/x-python' })
}

async function chooseFiles(user: ReturnType<typeof userEvent.setup>, files: File[]) {
  const input = document.querySelector<HTMLInputElement>('input[type=file]')
  if (!input) throw new Error('no file input')
  await user.upload(input, files)
}

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
  state.upload.mockReset()
  state.upload.mockResolvedValue({})
  state.checks = ALL_OK
  state.checked = []
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('SubmissionsPage upload checks', () => {
  it('runs the code checks and uploads only when they pass', async () => {
    const user = userEvent.setup()
    renderPage()
    await chooseFiles(user, [py('search.py', SEARCH_CODE), py('tiebreaker.py', TIEBREAKER_CODE)])
    await waitFor(() => expect(state.upload).toHaveBeenCalledTimes(1))
    expect(state.checked).toEqual([{ search: SEARCH_CODE, tiebreaker: TIEBREAKER_CODE }])
    expect((await screen.findAllByText(/Uploaded and queued/)).length).toBeGreaterThan(0)
  })

  it('rejects a syntax error without uploading', async () => {
    const user = userEvent.setup()
    state.checks = ALL_OK.map((item, index) =>
      index === 0 ? { ...item, ok: false, message: "search.py line 9: expected ':'" } : { ...item, ok: false },
    )
    renderPage()
    await chooseFiles(user, [py('search.py', 'class Score\n'), py('tiebreaker.py', TIEBREAKER_CODE)])
    expect((await screen.findByRole('alert')).textContent).toMatch(
      /Syntax check failed: search\.py line 9: expected ':'\. Nothing was uploaded\./,
    )
    expect(state.upload).not.toHaveBeenCalled()
  })

  it('refuses the unedited starter template without running Python', async () => {
    const user = userEvent.setup()
    renderPage()
    await chooseFiles(user, [py('search.py', SEARCH_TEMPLATE), py('tiebreaker.py', TIEBREAKER_CODE)])
    expect((await screen.findByRole('alert')).textContent).toMatch(/search\.py is still the starter template/)
    expect(state.checked).toHaveLength(0)
    expect(state.upload).not.toHaveBeenCalled()
  })

  it('names the files it received when the names are wrong', async () => {
    const user = userEvent.setup()
    renderPage()
    await chooseFiles(user, [py('Search.py', SEARCH_CODE), py('tb.py', TIEBREAKER_CODE)])
    expect((await screen.findByRole('alert')).textContent).toMatch(
      /You uploaded Search\.py and tb\.py\. Name the files exactly search\.py and tiebreaker\.py/,
    )
    expect(state.checked).toHaveLength(0)
    expect(state.upload).not.toHaveBeenCalled()
  })
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
