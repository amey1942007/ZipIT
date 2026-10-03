import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router'
import { EditorView } from '@codemirror/view'
import type { CheckResult } from '@/arena/engineCore'
import { readStaged } from '@/lib/stagedSubmission'
import { PlaygroundPage } from '@/pages/PlaygroundPage'
import { SEARCH_TEMPLATE, TIEBREAKER_TEMPLATE } from '@/playground/templates'

const engine = vi.hoisted(() => ({ checks: [] as CheckResult[], calls: 0 }))

vi.mock('@/arena/engine', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/arena/engine')>()
  class FakeEngineClient {
    async check() {
      engine.calls += 1
      return { checks: engine.checks, error: null }
    }
    async run() {
      return { checks: engine.checks, result: null, error: null }
    }
    dispose() {}
  }
  return { ...actual, EngineClient: FakeEngineClient }
})

const DRAFTS_KEY = 'zipit.playground-drafts.v2'
const ALL_OK: CheckResult[] = ['syntax', 'imports', 'classes', 'output', 'smoke'].map((id) => ({
  id: id as CheckResult['id'],
  ok: true,
  message: '',
}))
const SEARCH_CODE = 'class Score:\n    def score(self, node, board):\n        return node.depth\n'
const TIEBREAKER_CODE = 'class TieBreaker:\n    def key(self, node, board):\n        return (node.head,)\n'

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/playground']}>
      <Routes>
        <Route path="/playground" element={<PlaygroundPage />} />
        <Route path="/submissions" element={<p>Submissions page</p>} />
      </Routes>
    </MemoryRouter>,
  )
}

async function editorFor(name: string): Promise<{ content: HTMLElement; view: EditorView }> {
  const content = await screen.findByLabelText(`${name} editor`)
  const view = EditorView.findFromDOM(content)
  if (!view) throw new Error('no editor view')
  return { content, view }
}

function replace(view: EditorView, text: string) {
  view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: text } })
}

async function writeBoth(user: ReturnType<typeof userEvent.setup>) {
  replace((await editorFor('search.py')).view, SEARCH_CODE)
  await user.click(screen.getByRole('tab', { name: 'tiebreaker.py' }))
  replace((await editorFor('tiebreaker.py')).view, TIEBREAKER_CODE)
}

function savedDrafts(): Record<string, string> {
  return JSON.parse(window.localStorage.getItem(DRAFTS_KEY) ?? '{}') as Record<string, string>
}

describe('code playground', () => {
  beforeEach(() => {
    window.localStorage.clear()
    window.sessionStorage.clear()
    engine.checks = ALL_OK
    engine.calls = 0
  })
  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it('starts from a skeleton that is not a solution, inside the comic panels and tabs', async () => {
    renderPage()
    const { view } = await editorFor('search.py')
    expect(view.state.doc.toString()).toBe(SEARCH_TEMPLATE)
    expect(SEARCH_TEMPLATE).toContain('raise NotImplementedError')
    expect(TIEBREAKER_TEMPLATE).toContain('raise NotImplementedError')
    expect(SEARCH_TEMPLATE).not.toMatch(/from helpers import/)
    expect(screen.getByText('PLAYGROUND · PANEL 1/2')).toBeInTheDocument()
    expect(screen.getByText('EDITOR · PANEL 2/2')).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'search.py' })).toHaveClass('zi-tab', 'zi-tab-active')
    expect(screen.getByRole('tab', { name: 'tiebreaker.py' })).toHaveClass('zi-tab', 'zi-tab-idle')
    expect(document.querySelector('.zi-codebox .cm-editor')).not.toBeNull()
  })

  it('accepts typing and autosaves the draft', async () => {
    const user = userEvent.setup()
    renderPage()
    const { content, view } = await editorFor('search.py')
    await user.click(content)
    view.dispatch({ selection: { anchor: view.state.doc.length } })
    await user.keyboard('# my tweak')
    await waitFor(() => expect(view.state.doc.toString()).toContain('# my tweak'))
    await waitFor(() => expect(savedDrafts()['search.py']).toContain('# my tweak'), { timeout: 3000 })
    expect(screen.getByText('Draft saved')).toBeInTheDocument()
  })

  it('keeps each file separate when switching tabs', async () => {
    const user = userEvent.setup()
    renderPage()
    const first = await editorFor('search.py')
    first.view.dispatch({ changes: { from: first.view.state.doc.length, insert: '\n# kept' } })
    await user.click(screen.getByRole('tab', { name: 'tiebreaker.py' }))
    const second = await editorFor('tiebreaker.py')
    expect(second.view.state.doc.toString()).toBe(TIEBREAKER_TEMPLATE)
    await user.click(screen.getByRole('tab', { name: 'search.py' }))
    const back = await editorFor('search.py')
    expect(back.view.state.doc.toString()).toContain('# kept')
  })

  it('restores the template only after confirming', async () => {
    const user = userEvent.setup()
    renderPage()
    const { view } = await editorFor('search.py')
    replace(view, 'x = 1\n')
    const confirm = vi.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValueOnce(true)
    await user.click(screen.getByRole('button', { name: 'Reset to template' }))
    expect((await editorFor('search.py')).view.state.doc.toString()).toBe('x = 1\n')
    await user.click(screen.getByRole('button', { name: 'Reset to template' }))
    await waitFor(async () => expect((await editorFor('search.py')).view.state.doc.toString()).toBe(SEARCH_TEMPLATE))
    expect(confirm).toHaveBeenCalledTimes(2)
    expect(savedDrafts()['search.py']).toBe(SEARCH_TEMPLATE)
  })

  it('refuses to submit the untouched template', async () => {
    renderPage()
    await editorFor('search.py')
    fireEvent.click(screen.getByRole('button', { name: 'Submit' }))
    expect(await screen.findByText(/Write your own code first: search\.py and tiebreaker\.py are still/)).toBeInTheDocument()
    expect(screen.queryByText('Submissions page')).not.toBeInTheDocument()
    expect(readStaged()).toBeNull()
    expect(engine.calls).toBe(0)
  })

  it('refuses to submit when a check fails', async () => {
    const user = userEvent.setup()
    engine.checks = [
      { id: 'syntax', ok: true, message: '' },
      { id: 'imports', ok: true, message: '' },
      { id: 'classes', ok: true, message: '' },
      { id: 'output', ok: false, message: 'search.py line 3: ZeroDivisionError' },
    ]
    renderPage()
    await writeBoth(user)
    await user.click(screen.getByRole('button', { name: 'Submit' }))
    expect(await screen.findByText('Fix the failed check before submitting.')).toBeInTheDocument()
    expect(screen.getByText('search.py line 3: ZeroDivisionError')).toBeInTheDocument()
    expect(screen.queryByText('Submissions page')).not.toBeInTheDocument()
    expect(readStaged()).toBeNull()
  })

  it('opens a helper card with its real source on hover and closes it on Escape', async () => {
    const user = userEvent.setup()
    renderPage()
    const trigger = screen.getByRole('button', { name: 'bfs_distance(board, src, dst, visited=None)' })
    await user.hover(trigger)
    const card = await screen.findByRole('region', { name: 'bfs_distance helper' })
    expect(card).toHaveTextContent(/shortest real walk/i)
    expect(card).toHaveTextContent('def bfs_distance(board, src, dst, visited=None) -> int | None:')
    expect(card).toHaveTextContent('bfs_distance(board, 5, 7, node) → 4')
    expect(trigger).toHaveAttribute('aria-expanded', 'true')
    trigger.focus()
    await user.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('region', { name: 'bfs_distance helper' })).toBeNull())
  })

  it('shows real node and board values in the reference tabs', async () => {
    const user = userEvent.setup()
    renderPage()
    expect(screen.getByText('WHAT YOUR CODE RECEIVES')).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'board' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByText('[(0, 0), (1, 3), (3, 0)]')).toBeInTheDocument()
    await user.click(screen.getByRole('tab', { name: 'node' }))
    expect(screen.getByText('node.visited')).toBeInTheDocument()
    expect(screen.getByText('[0, 1, 5]')).toBeInTheDocument()
    await user.click(screen.getByRole('tab', { name: 'what to return' }))
    expect(screen.getByText('(-free_degree(node, board), node.head)')).toBeInTheDocument()
  })

  it('stages both files and opens Submissions once every check passes', async () => {
    const user = userEvent.setup()
    renderPage()
    await writeBoth(user)
    await user.click(screen.getByRole('button', { name: 'Submit' }))
    expect(await screen.findByText('Submissions page')).toBeInTheDocument()
    expect(engine.calls).toBe(1)
    const staged = readStaged()
    expect(staged?.search).toBe(SEARCH_CODE)
    expect(staged?.tiebreaker).toBe(TIEBREAKER_CODE)
  })
})
