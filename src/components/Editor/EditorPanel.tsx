// src/components/Editor/EditorPanel.tsx
import { useEffect, useRef } from 'react'
import { useTranslation } from '../../i18n/useTranslation'
import { useAppStore } from '../../store/appStore'
import { gotoDefinition, readFile, readPreviewCache, writeFile } from '../../tauri/commands'
import { CodeMirrorEditor, type CodeMirrorEditorHandle } from './CodeMirrorEditor'
import { EditorTabs } from './EditorTabs'
import { useCompilation } from '../../hooks/useCompilation'

function resolveImportPath(fromFile: string, importPath: string): string {
  const fromDir = fromFile.split('/').slice(0, -1)
  const parts = importPath.replace(/^\.\//, '').split('/')
  const resolved = [...fromDir]
  for (const part of parts) {
    if (part === '..') resolved.pop()
    else if (part !== '.') resolved.push(part)
  }
  return resolved.join('/')
}

export function EditorPanel() {
  const {
    activeFile, openFiles, tmpPath, entryFile,
    markFileSaved, openFile, setPages,
    compileErrors, pendingJump, setPendingJump,
  } = useAppStore()

  const { t } = useTranslation()
  const editorRef = useRef<CodeMirrorEditorHandle>(null)
  const pendingJumpRef = useRef<number | undefined>(undefined)
  const scrollPositionsRef = useRef<Record<string, number>>({})
  const compileErrorsRef = useRef(compileErrors)
  useEffect(() => { compileErrorsRef.current = compileErrors }, [compileErrors])

  const { runCompile, handleChange, handleCursorLine, jumpedAtRef } = useCompilation(
    (errors) => editorRef.current?.applyErrors(errors)
  )

  // Load cache + initial compile when project changes
  useEffect(() => {
    scrollPositionsRef.current = {}
    if (!tmpPath) return
    readPreviewCache(tmpPath).then((cached) => {
      if (cached && cached.length > 0) setPages(cached)
    })
    runCompile()
  }, [tmpPath])

  // Handle pending jump (from ctrl+click or go-to-definition)
  useEffect(() => {
    if (!pendingJump) return
    if (pendingJump.file !== activeFile) {
      readFile(tmpPath!, pendingJump.file)
        .then((content) => {
          pendingJumpRef.current = pendingJump.byteOffset
          openFile({ path: pendingJump.file, content, isDirty: false })
        })
        .catch(() => {})
        .finally(() => setPendingJump(null))
      return
    }
    jumpedAtRef.current = Date.now()
    editorRef.current?.jumpTo(pendingJump.byteOffset)
    setPendingJump(null)
  }, [pendingJump, activeFile])

  async function handleGotoDefinition(cursorByte: number) {
    if (!tmpPath || !activeFile) return
    const content = openFiles.find(f => f.path === activeFile)?.content ?? ''
    const charPos = new TextDecoder().decode(new TextEncoder().encode(content).slice(0, cursorByte)).length
    const lineStart = content.lastIndexOf('\n', charPos - 1) + 1
    const lineEnd = content.indexOf('\n', charPos)
    const line = content.slice(lineStart, lineEnd === -1 ? undefined : lineEnd)
    const m = line.match(/^#(?:import|include)\s+"([^"]*)"/)
    if (m) {
      const importPath = m[1]
      if (!importPath.startsWith('@')) {
        const resolved = resolveImportPath(activeFile, importPath)
        const fileContent = await readFile(tmpPath, resolved).catch(() => null)
        if (fileContent !== null) { openFile({ path: resolved, content: fileContent, isDirty: false }); return }
      }
    }
    const result = await gotoDefinition(tmpPath, entryFile, activeFile, content, cursorByte).catch(() => null)
    if (!result) return
    if (result.file != null && result.byteOffset != null) {
      setPendingJump({ file: result.file, byteOffset: result.byteOffset })
    }
  }

  async function handleSave() {
    if (!tmpPath || !activeFile) return
    const file = openFiles.find(f => f.path === activeFile)
    if (!file) return
    await writeFile(tmpPath, activeFile, file.content)
    markFileSaved(activeFile)
  }

  const activeContent = openFiles.find(f => f.path === activeFile)?.content ?? ''

  if (!activeFile) {
    return (
      <div className="h-full bg-[#1e1e2e] flex flex-col">
        <EditorTabs />
        <div className="flex-1 flex items-center justify-center text-[#585b70] text-sm">
          {t('editor.openFileHint')}
        </div>
      </div>
    )
  }

  return (
    <div className="h-full bg-[#1e1e2e] flex flex-col">
      <EditorTabs />
      <div className="flex-1 overflow-hidden">
        <CodeMirrorEditor
          key={activeFile}
          ref={editorRef}
          content={activeContent}
          onChange={handleChange}
          onCursorLine={handleCursorLine}
          onSave={handleSave}
          onGotoDefinition={handleGotoDefinition}
          initialOffset={pendingJumpRef.current}
          initialScrollTop={scrollPositionsRef.current[activeFile]}
          onScrollTop={(y) => { scrollPositionsRef.current[activeFile!] = y }}
          onMounted={() => {
            pendingJumpRef.current = undefined
            if (activeFile) {
              const errs = compileErrorsRef.current.filter(
                e => !e.file || e.file === activeFile || e.file === '<unknown>'
              )
              editorRef.current?.applyErrors(errs)
            }
          }}
          tmpPath={tmpPath}
          entryFile={entryFile}
          currentFile={activeFile}
        />
      </div>
    </div>
  )
}
