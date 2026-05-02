import { useEffect, useRef } from 'react'
import { Compartment, EditorState } from '@codemirror/state'
import { EditorView, keymap, lineNumbers } from '@codemirror/view'
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands'
import { syntaxHighlighting, defaultHighlightStyle } from '@codemirror/language'
import { oneDark } from '@codemirror/theme-one-dark'
import { typstLanguage } from '../../lib/typst-language'

interface Props {
  content: string
  onChange: (content: string) => void
  onSave: () => void
}

const DEFAULT_FONT_SIZE = 14
const MIN_FONT_SIZE = 8
const MAX_FONT_SIZE = 32

function fontTheme(size: number) {
  return EditorView.theme({
    '&': { height: '100%', fontSize: `${size}px` },
    '.cm-scroller': { overflow: 'auto', fontFamily: "'JetBrains Mono', 'Fira Code', monospace" },
  })
}

export function CodeMirrorEditor({ content, onChange, onSave }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)
  const fontSizeRef = useRef(DEFAULT_FONT_SIZE)
  const fontCompartment = useRef(new Compartment())

  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange
  const onSaveRef = useRef(onSave)
  onSaveRef.current = onSave

  useEffect(() => {
    if (!containerRef.current) return

    const extensions = [
      lineNumbers(),
      history(),
      keymap.of([
        indentWithTab,
        ...defaultKeymap,
        ...historyKeymap,
        { key: 'Mod-s', run: () => { onSaveRef.current(); return true } },
      ]),
      oneDark,
      syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
      typstLanguage,
      EditorView.updateListener.of((update) => {
        if (update.docChanged) {
          onChangeRef.current(update.state.doc.toString())
        }
      }),
      fontCompartment.current.of(fontTheme(fontSizeRef.current)),
    ]

    const state = EditorState.create({ doc: content, extensions })
    const view = new EditorView({ state, parent: containerRef.current })
    viewRef.current = view

    return () => { view.destroy(); viewRef.current = null }
  }, [])

  // Ctrl+wheel → adjust font size without React re-render
  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const handleWheel = (e: WheelEvent) => {
      if (!e.ctrlKey) return
      e.preventDefault()
      const delta = e.deltaY < 0 ? 1 : -1
      const next = Math.min(MAX_FONT_SIZE, Math.max(MIN_FONT_SIZE, fontSizeRef.current + delta))
      if (next === fontSizeRef.current) return
      fontSizeRef.current = next
      viewRef.current?.dispatch({
        effects: fontCompartment.current.reconfigure(fontTheme(next)),
      })
    }

    el.addEventListener('wheel', handleWheel, { passive: false })
    return () => el.removeEventListener('wheel', handleWheel)
  }, [])

  // Sync external content → editor (e.g. file opened from explorer)
  useEffect(() => {
    const view = viewRef.current
    if (!view) return
    const current = view.state.doc.toString()
    if (current !== content) {
      view.dispatch({
        changes: { from: 0, to: current.length, insert: content },
      })
    }
  }, [content])

  return <div ref={containerRef} className="h-full overflow-hidden" />
}
