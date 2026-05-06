// src/hooks/useProjectOps.ts
import { useState } from 'react'
import { open, save } from '@tauri-apps/plugin-dialog'
import { useAppStore } from '../store/appStore'
import {
  newProject, openProject, saveProject,
  readFile, writeFile, cleanupTmp,
} from '../tauri/commands'

export type PendingSwitch = 'none' | 'newProject' | 'openProject' | 'openRecent'

export function useProjectOps() {
  const [pendingSwitch, setPendingSwitch] = useState<PendingSwitch>('none')
  const [pendingRecentPath, setPendingRecentPath] = useState<string | null>(null)

  const {
    tmpPath, typzPath, openFiles, activeFile,
    setProject, setTypzPath, openFile, markFileSaved,
    addRecentProject, removeRecentProject,
  } = useAppStore()

  function hasUnsavedContent() {
    return openFiles.some(f => f.isDirty || f.content.trim() !== '')
  }

  async function doNewProject() {
    const name = `projet-${Date.now()}`
    const info = await newProject(name)
    setProject(info.tmpPath, null, 'main.typ', info.tree)
    const content = await readFile(info.tmpPath, 'main.typ')
    openFile({ path: 'main.typ', content, isDirty: false })
  }

  async function doOpenProject() {
    const selected = await open({ filters: [{ name: 'Typst Project', extensions: ['typz'] }] })
    if (!selected) return
    const info = await openProject(selected as string)
    setProject(info.tmpPath, selected as string, 'main.typ', info.tree)
    addRecentProject(selected as string)
    const content = await readFile(info.tmpPath, 'main.typ').catch(() => '')
    if (content !== null) openFile({ path: 'main.typ', content, isDirty: false })
  }

  async function doOpenWithPath(path: string) {
    try {
      const info = await openProject(path)
      setProject(info.tmpPath, path, 'main.typ', info.tree)
      addRecentProject(path)
      const content = await readFile(info.tmpPath, 'main.typ').catch(() => '')
      if (content !== null) openFile({ path: 'main.typ', content, isDirty: false })
    } catch {
      removeRecentProject(path)
    }
  }

  async function doSwitch(which: PendingSwitch) {
    setPendingSwitch('none')
    if (which === 'newProject') await doNewProject()
    else if (which === 'openProject') await doOpenProject()
    else if (which === 'openRecent' && pendingRecentPath) {
      const path = pendingRecentPath
      setPendingRecentPath(null)
      await doOpenWithPath(path)
    }
  }

  function handleNewProject() {
    if (tmpPath && hasUnsavedContent()) { setPendingSwitch('newProject'); return }
    doNewProject()
  }

  function handleOpenProject() {
    if (tmpPath && hasUnsavedContent()) { setPendingSwitch('openProject'); return }
    doOpenProject()
  }

  function handleOpenFromRecent(path: string) {
    if (tmpPath && hasUnsavedContent()) {
      setPendingRecentPath(path)
      setPendingSwitch('openRecent')
      return
    }
    doOpenWithPath(path)
  }

  async function handleSaveAndSwitch() {
    if (!tmpPath) return
    const oldTmp = tmpPath
    const which = pendingSwitch
    if (typzPath) {
      const file = openFiles.find(f => f.path === activeFile)
      if (file) { await writeFile(oldTmp, file.path, file.content); markFileSaved(file.path) }
      await saveProject(oldTmp, typzPath)
    } else {
      const outPath = await save({ filters: [{ name: 'Typst Project', extensions: ['typz'] }] })
      if (!outPath) return
      setTypzPath(outPath as string)
      addRecentProject(outPath as string)
      await saveProject(oldTmp, outPath as string)
    }
    await cleanupTmp(oldTmp)
    await doSwitch(which)
  }

  async function handleDiscardAndSwitch() {
    if (!tmpPath) return
    const oldTmp = tmpPath
    const which = pendingSwitch
    await cleanupTmp(oldTmp)
    await doSwitch(which)
  }

  return {
    pendingSwitch,
    setPendingSwitch,
    handleNewProject,
    handleOpenProject,
    handleOpenFromRecent,
    handleSaveAndSwitch,
    handleDiscardAndSwitch,
  }
}
