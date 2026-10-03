import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router'
import { EditorView } from '@codemirror/view'
import { readStaged } from '@/lib/stagedSubmission'
import { PlaygroundPage } from '@/pages/PlaygroundPage'
import { SEARCH_TEMPLATE, TIEBREAKER_TEMPLATE } from '@/playground/templates'

const DRAFTS_KEY = 'zipit.playground-drafts.v1'

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

function savedDrafts(): Record<string, string> {
  return JSON.parse(window.localStorage.getItem(DRAFTS_KEY) ?? '{}') as Record<string, string>
}

describe('code playground', () => {
  beforeEach(() => {
    window.localStorage.clear()
    window.sessionStorage.clear()
  })
  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it('starts both tabs from the template and uses the comic panels and tabs', async () => {
    renderPage()
    const { view } = await editorFor('search.py')
    expect(view.state.doc.toString()).toBe(SEARCH_TEMPLATE)
    expect(screen.getByText('PLAYGROUND · PANEL 1/2')).toBeInTheDocument()
    expect(screen.getByText('EDITOR · PANEL 2/2')).toBeInTheDocument()
    const tab = screen.getByRole('tab', { name: 'search.py' })
    expect(tab).toHaveClass('zi-tab', 'zi-tab-active')
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
    view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: 'x = 1\n' } })
    const confirm = vi.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValueOnce(true)
    await user.click(screen.getByRole('button', { name: 'Reset to template' }))
    expect((await editorFor('search.py')).view.state.doc.toString()).toBe('x = 1\n')
    await user.click(screen.getByRole('button', { name: 'Reset to template' }))
    await waitFor(async () => expect((await editorFor('search.py')).view.state.doc.toString()).toBe(SEARCH_TEMPLATE))
    expect(confirm).toHaveBeenCalledTimes(2)
    expect(savedDrafts()['search.py']).toBe(SEARCH_TEMPLATE)
  })

  it('stages both files and opens Submissions', async () => {
    renderPage()
    const { view } = await editorFor('search.py')
    view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: 'class Score:\n    pass\n' } })
    fireEvent.click(screen.getByRole('button', { name: 'Submit' }))
    expect(await screen.findByText('Submissions page')).toBeInTheDocument()
    const staged = readStaged()
    expect(staged?.search).toBe('class Score:\n    pass\n')
    expect(staged?.tiebreaker).toBe(TIEBREAKER_TEMPLATE)
  })
})
