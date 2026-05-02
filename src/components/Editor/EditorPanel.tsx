import { useRef, useCallback, useEffect } from 'react'
import { EditorTabs } from './EditorTabs'
import { CodeMirrorEditor } from './CodeMirrorEditor'
import { useAppStore } from '../../store/appStore'
import { writeFile, compilePreview, readPreviewCache, writePreviewCache } from '../../tauri/commands'

const DEBOUNCE_MS = 300

export function EditorPanel() {
  const {
    activeFile, openFiles, tmpPath, entryFile,
    updateFileContent, markFileSaved,
    setPages, setCompiling, setCompileErrors, appendOutput, clearOutput,
  } = useAppStore()

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const activeContent = openFiles.find((f) => f.path === activeFile)?.content ?? ''

  const runCompile = useCallback(async () => {
    if (!tmpPath) return
    setCompiling(true)
    clearOutput()
    try {
      const result = await compilePreview(tmpPath, entryFile)
      setPages(result.pages)
      setCompileErrors(result.errors)
      appendOutput(result.output)
      if (result.pages.length > 0) writePreviewCache(tmpPath, result.pages)
    } catch (err) {
      appendOutput(String(err))
    } finally {
      setCompiling(false)
    }
  }, [tmpPath, entryFile])

  // On project open / session restore: show cache instantly, then compile in background
  useEffect(() => {
    if (!tmpPath) return
    // Show cached pages instantly, then compile in background
    readPreviewCache(tmpPath).then((cached) => {
      if (cached && cached.length > 0) setPages(cached)
    })
    runCompile()
  }, [tmpPath, runCompile])

  function handleChange(content: string) {
    if (!activeFile) return
    updateFileContent(activeFile, content)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      if (!tmpPath) return
      await writeFile(tmpPath, activeFile, content).catch(() => {})
      runCompile()
    }, DEBOUNCE_MS)
  }

  async function handleSave() {
    if (!tmpPath || !activeFile) return
    const file = openFiles.find((f) => f.path === activeFile)
    if (!file) return
    await writeFile(tmpPath, activeFile, file.content)
    markFileSaved(activeFile)
  }

  if (!activeFile) {
    return (
      <div className="h-full bg-[#1e1e2e] flex flex-col">
        <EditorTabs />
        <div className="flex-1 flex items-center justify-center text-[#585b70] text-sm">
          Ouvrir un fichier depuis l'explorateur
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
          content={activeContent}
          onChange={handleChange}
          onSave={handleSave}
        />
      </div>
    </div>
  )
}
