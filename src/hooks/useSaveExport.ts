// src/hooks/useSaveExport.ts
import { save } from '@tauri-apps/plugin-dialog'
import { useAppStore } from '../store/appStore'
import { saveProject, writeFile, exportProject, createVersion } from '../tauri/commands'

export function useSaveExport() {
  const {
    tmpPath, typzPath, entryFile, openFiles, activeFile,
    setTypzPath, markFileSaved, addRecentProject,
  } = useAppStore()

  function currentStem(): string {
    if (typzPath) return typzPath.replace(/\\/g, '/').split('/').pop()!.replace(/\.typz$/i, '')
    return entryFile.replace(/\.typ$/i, '')
  }

  async function handleSave() {
    if (!tmpPath) return
    if (typzPath) {
      const file = openFiles.find(f => f.path === activeFile)
      if (file) { await writeFile(tmpPath, file.path, file.content); markFileSaved(file.path) }
      await saveProject(tmpPath, typzPath)
      createVersion(tmpPath).catch(() => {})
    } else {
      const outPath = await save({
        defaultPath: `${currentStem()}.typz`,
        filters: [{ name: 'Typst Project', extensions: ['typz'] }],
      })
      if (!outPath) return
      setTypzPath(outPath as string)
      addRecentProject(outPath as string)
      await saveProject(tmpPath, outPath as string)
    }
  }

  async function handleSaveAs() {
    if (!tmpPath) return
    const outPath = await save({
      defaultPath: `${currentStem()} (copie).typz`,
      filters: [{ name: 'Typst Project', extensions: ['typz'] }],
    })
    if (!outPath) return
    setTypzPath(outPath as string)
    addRecentProject(outPath as string)
    await saveProject(tmpPath, outPath as string)
  }

  async function handleExport(format: 'pdf' | 'png' | 'svg') {
    if (!tmpPath) return
    const outPath = await save({
      defaultPath: `${currentStem()}.${format}`,
      filters: [{ name: format.toUpperCase(), extensions: [format] }],
    })
    if (!outPath) return
    await exportProject(tmpPath, entryFile, format, outPath as string)
  }

  return { handleSave, handleSaveAs, handleExport }
}
