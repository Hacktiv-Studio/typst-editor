import { useRef } from 'react'
import { EditorTabs } from './EditorTabs'
import { CodeMirrorEditor } from './CodeMirrorEditor'
import { useAppStore } from '../../store/appStore'
import { writeFile, compilePreview, saveProject } from '../../tauri/commands'

const DEBOUNCE_MS = 300

export function EditorPanel() {
  const {
    activeFile, openFiles, tmpPath, typzPath, entryFile,
    updateFileContent, markFileSaved,
    setPages, setCompiling, setCompileErrors, appendOutput, clearOutput,
  } = useAppStore()

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const activeContent = openFiles.find((f) => f.path === activeFile)?.content ?? ''

  async function runCompile() {
    if (!tmpPath) return
    setCompiling(true)
    clearOutput()
    try {
      const result = await compilePreview(tmpPath, entryFile)
      setPages(result.pages)
      setCompileErrors(result.errors)
      appendOutput(result.output)
    } catch (err) {
      appendOutput(String(err))
    } finally {
      setCompiling(false)
    }
  }

  function handleChange(content: string) {
    if (!activeFile) return
    updateFileContent(activeFile, content)
    if (tmpPath) {
      writeFile(tmpPath, activeFile, content).catch(() => {})
    }
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(runCompile, DEBOUNCE_MS)
  }

  async function handleSave() {
    if (!tmpPath || !activeFile) return
    const file = openFiles.find((f) => f.path === activeFile)
    if (!file) return
    await writeFile(tmpPath, activeFile, file.content)
    markFileSaved(activeFile)
    if (typzPath) {
      await saveProject(tmpPath, typzPath)
    }
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
