import { useEffect, useRef } from 'react'
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands'
import { python } from '@codemirror/lang-python'
import { bracketMatching, HighlightStyle, indentOnInput, indentUnit, syntaxHighlighting } from '@codemirror/language'
import { EditorState, type Extension } from '@codemirror/state'
import {
  drawSelection,
  EditorView,
  highlightActiveLine,
  highlightActiveLineGutter,
  keymap,
  lineNumbers,
} from '@codemirror/view'
import { tags } from '@lezer/highlight'

const theme = EditorView.theme(
  {
    '&': { height: '100%', color: 'var(--color-ivory)', backgroundColor: 'var(--color-ink)', fontSize: '14px' },
    '&.cm-focused': { outline: 'none' },
    '.cm-scroller': { fontFamily: 'var(--font-mono)', lineHeight: '1.6' },
    '.cm-content': { caretColor: 'var(--color-gold)', padding: '12px 0' },
    '.cm-cursor, .cm-dropCursor': { borderLeftColor: 'var(--color-gold)', borderLeftWidth: '2px' },
    '&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection':
      { backgroundColor: 'rgba(255, 200, 61, 0.28)' },
    '.cm-gutters': { backgroundColor: 'var(--color-ink)', color: 'rgba(255, 246, 232, 0.4)', border: 'none' },
    '.cm-lineNumbers .cm-gutterElement': { padding: '0 12px 0 8px' },
    '.cm-activeLine': { backgroundColor: 'rgba(255, 246, 232, 0.05)' },
    '.cm-activeLineGutter': { backgroundColor: 'rgba(255, 246, 232, 0.05)', color: 'var(--color-gold)' },
    '&.cm-focused .cm-matchingBracket': { outline: '1px solid var(--color-gold)', backgroundColor: 'transparent' },
    '&.cm-focused .cm-nonmatchingBracket': { outline: '1px solid var(--color-comic-red)', backgroundColor: 'transparent' },
  },
  { dark: true },
)

const highlight = HighlightStyle.define([
  { tag: [tags.keyword, tags.controlKeyword, tags.definitionKeyword, tags.moduleKeyword, tags.operatorKeyword], color: 'var(--color-gold)', fontWeight: '700' },
  { tag: [tags.bool, tags.null, tags.self], color: 'var(--color-gold)' },
  { tag: [tags.string, tags.special(tags.string)], color: 'var(--color-red-text)' },
  { tag: [tags.number, tags.integer, tags.float], color: 'var(--color-warning)' },
  { tag: tags.comment, color: 'var(--color-ivory-muted)', fontStyle: 'italic' },
  { tag: [tags.function(tags.definition(tags.variableName)), tags.definition(tags.className)], color: 'var(--color-ivory)', fontWeight: '700' },
  { tag: tags.invalid, color: 'var(--color-comic-red)', textDecoration: 'underline' },
])

export interface CodeEditorProps<F extends string> {
  file: F
  docs: Record<F, string>
  /** Bump to replace every buffer with `docs` (Reset to template). */
  resetKey: number
  label: string
  onChange: (file: F, text: string) => void
  onSave: () => void
}

/** One view, one EditorState per file, so each tab keeps its own undo history and cursor. */
export default function CodeEditor<F extends string>({ file, docs, resetKey, label, onChange, onSave }: CodeEditorProps<F>) {
  const host = useRef<HTMLDivElement>(null)
  const view = useRef<EditorView | null>(null)
  const states = useRef(new Map<F, EditorState>())
  const shown = useRef<F | null>(null)
  const latest = useRef({ docs, onChange, onSave })

  useEffect(() => {
    latest.current = { docs, onChange, onSave }
  })

  useEffect(() => {
    if (!host.current) return
    const created = new EditorView({ parent: host.current })
    const buffers = states.current
    view.current = created
    return () => {
      created.destroy()
      view.current = null
      buffers.clear()
      shown.current = null
    }
  }, [])

  useEffect(() => {
    states.current.clear()
    shown.current = null
  }, [resetKey])

  useEffect(() => {
    const active = view.current
    if (!active) return
    if (shown.current === file) return
    if (shown.current !== null) states.current.set(shown.current, active.state)
    const saved =
      states.current.get(file) ??
      EditorState.create({
        doc: latest.current.docs[file],
        extensions: extensionsFor(file, {
          save: () => latest.current.onSave(),
          change: (text) => latest.current.onChange(file, text),
        }),
      })
    active.setState(saved)
    shown.current = file
  }, [file, resetKey])

  return <div ref={host} role="group" aria-label={label} className="h-[min(60svh,560px)] min-h-72 overflow-hidden" />
}

function extensionsFor(target: string, on: { save: () => void; change: (text: string) => void }): Extension[] {
  return [
    lineNumbers(),
    highlightActiveLineGutter(),
    highlightActiveLine(),
    drawSelection(),
    history(),
    indentOnInput(),
    indentUnit.of('    '),
    EditorState.tabSize.of(4),
    bracketMatching(),
    python(),
    syntaxHighlighting(highlight),
    theme,
    EditorView.contentAttributes.of({ 'aria-label': `${target} editor`, spellcheck: 'false', autocapitalize: 'off' }),
    keymap.of([
      {
        key: 'Mod-s',
        preventDefault: true,
        run: () => {
          on.save()
          return true
        },
      },
      indentWithTab,
      ...defaultKeymap,
      ...historyKeymap,
    ]),
    EditorView.updateListener.of((update) => {
      if (update.docChanged) on.change(update.state.doc.toString())
    }),
  ]
}
