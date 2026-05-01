import { useState, useCallback } from 'react'
import {
  FaChevronRight, FaChevronDown,
  FaFolder, FaFolderOpen, FaFileLines,
} from 'react-icons/fa6'
import { useAppStore } from '../../store/appStore'
import {
  readFile, createFile, createFolder, listProject,
  renamePath, deletePath, importFile, importFolder,
} from '../../tauri/commands'
import { open as openDialog } from '@tauri-apps/plugin-dialog'
import type { ProjectEntry } from '../../types'
import { InputDialog } from '../ui/InputDialog'
import { ConfirmDialog } from '../ui/ConfirmDialog'
import { ContextMenu, type ContextMenuEntry } from '../ui/ContextMenu'

type DialogState =
  | { type: 'none' }
  | { type: 'newFile'; parentDir: string }
  | { type: 'newFolder'; parentDir: string }
  | { type: 'rename'; entry: ProjectEntry }
  | { type: 'delete'; entry: ProjectEntry }

type MenuState =
  | { type: 'none' }
  | { type: 'background'; x: number; y: number; parentDir: string }
  | { type: 'entry'; x: number; y: number; entry: ProjectEntry }

function TreeNode({
  entry,
  depth = 0,
  onContextMenu,
}: {
  entry: ProjectEntry
  depth?: number
  onContextMenu: (e: React.MouseEvent, entry: ProjectEntry) => void
}) {
  const [open, setOpen] = useState(depth === 0)
  const { tmpPath, openFile, activeFile } = useAppStore()

  async function handleFileClick() {
    if (!tmpPath) return
    const content = await readFile(tmpPath, entry.path)
    openFile({ path: entry.path, content, isDirty: false })
  }

  const isActive = !entry.isDir && entry.path === activeFile

  return (
    <div>
      <div
        className={`flex items-center gap-1.5 py-0.5 cursor-pointer text-[#a6adc8] text-[10px] group select-none ${
          isActive ? 'bg-[#313244]' : 'hover:bg-[#313244]/50'
        }`}
        style={{ paddingLeft: `${16 + depth * 12}px` }}
        onClick={() => (entry.isDir ? setOpen((o) => !o) : handleFileClick())}
        onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); onContextMenu(e, entry) }}
      >
        {entry.isDir ? (
          open
            ? <FaChevronDown size={8} className="text-[#585b70]" />
            : <FaChevronRight size={8} className="text-[#585b70]" />
        ) : (
          <span className="w-2" />
        )}
        {entry.isDir
          ? (open
              ? <FaFolderOpen size={11} className="text-[#f9e2af]" />
              : <FaFolder size={11} className="text-[#f9e2af]" />)
          : <FaFileLines size={11} className="text-[#89b4fa]" />
        }
        <span className="truncate flex-1">{entry.name}</span>
      </div>
      {entry.isDir && open && entry.children?.map((child) => (
        <TreeNode key={child.path} entry={child} depth={depth + 1} onContextMenu={onContextMenu} />
      ))}
    </div>
  )
}

export function FileTree() {
  const { projectTree, tmpPath, setProjectTree } = useAppStore()
  const [dialog, setDialog] = useState<DialogState>({ type: 'none' })
  const [menu, setMenu] = useState<MenuState>({ type: 'none' })

  const refreshTree = useCallback(async () => {
    if (!tmpPath) return
    const tree = await listProject(tmpPath)
    setProjectTree(tree)
  }, [tmpPath, setProjectTree])

  function openEntryMenu(e: React.MouseEvent, entry: ProjectEntry) {
    setMenu({ type: 'entry', x: e.clientX, y: e.clientY, entry })
  }

  function openBackgroundMenu(e: React.MouseEvent) {
    e.preventDefault()
    setMenu({ type: 'background', x: e.clientX, y: e.clientY, parentDir: '' })
  }

  async function handleCreateFile(parentDir: string, name: string) {
    if (!tmpPath) return
    const rel = parentDir ? `${parentDir}/${name}` : name
    await createFile(tmpPath, rel)
    await refreshTree()
  }

  async function handleCreateFolder(parentDir: string, name: string) {
    if (!tmpPath) return
    const rel = parentDir ? `${parentDir}/${name}` : name
    await createFolder(tmpPath, rel)
    await refreshTree()
  }

  async function handleRename(entry: ProjectEntry, newName: string) {
    if (!tmpPath) return
    const parent = entry.path.includes('/')
      ? entry.path.substring(0, entry.path.lastIndexOf('/'))
      : ''
    const newRel = parent ? `${parent}/${newName}` : newName
    await renamePath(tmpPath, entry.path, newRel)
    await refreshTree()
  }

  async function handleDelete(entry: ProjectEntry) {
    if (!tmpPath) return
    await deletePath(tmpPath, entry.path)
    await refreshTree()
  }

  async function handleImportFile(_parentDir: string) {
    if (!tmpPath) return
    const selected = await openDialog({ multiple: false })
    if (!selected) return
    await importFile(tmpPath, selected as string)
    await refreshTree()
  }

  async function handleImportFolder(_parentDir: string) {
    if (!tmpPath) return
    const selected = await openDialog({ directory: true })
    if (!selected) return
    await importFolder(tmpPath, selected as string)
    await refreshTree()
  }

  function backgroundMenuItems(parentDir: string): ContextMenuEntry[] {
    return [
      { label: 'Nouveau fichier', onClick: () => setDialog({ type: 'newFile', parentDir }) },
      { label: 'Nouveau dossier', onClick: () => setDialog({ type: 'newFolder', parentDir }) },
      'separator',
      { label: 'Importer un fichier', onClick: () => handleImportFile(parentDir) },
      { label: 'Importer un dossier', onClick: () => handleImportFolder(parentDir) },
    ]
  }

  function entryMenuItems(entry: ProjectEntry): ContextMenuEntry[] {
    return [
      { label: 'Renommer', onClick: () => setDialog({ type: 'rename', entry }) },
      'separator',
      { label: 'Supprimer', onClick: () => setDialog({ type: 'delete', entry }), danger: true },
    ]
  }

  return (
    <div
      className="flex-1 overflow-auto"
      onContextMenu={openBackgroundMenu}
    >
      <div className="px-2 py-1.5 text-[9px] font-bold uppercase tracking-wider text-[#585b70]">
        Projet
      </div>

      {projectTree.map((entry) => (
        <TreeNode key={entry.path} entry={entry} onContextMenu={openEntryMenu} />
      ))}

      <div className="min-h-[60px]" />

      {menu.type === 'background' && (
        <ContextMenu
          x={menu.x} y={menu.y}
          items={backgroundMenuItems(menu.parentDir)}
          onClose={() => setMenu({ type: 'none' })}
        />
      )}
      {menu.type === 'entry' && (
        <ContextMenu
          x={menu.x} y={menu.y}
          items={entryMenuItems(menu.entry)}
          onClose={() => setMenu({ type: 'none' })}
        />
      )}

      {dialog.type === 'newFile' && (
        <InputDialog
          title="Nouveau fichier"
          label="Nom du fichier"
          onConfirm={(name) => handleCreateFile(dialog.parentDir, name)}
          onClose={() => setDialog({ type: 'none' })}
        />
      )}
      {dialog.type === 'newFolder' && (
        <InputDialog
          title="Nouveau dossier"
          label="Nom du dossier"
          onConfirm={(name) => handleCreateFolder(dialog.parentDir, name)}
          onClose={() => setDialog({ type: 'none' })}
        />
      )}
      {dialog.type === 'rename' && (
        <InputDialog
          title="Renommer"
          label="Nouveau nom"
          defaultValue={dialog.entry.name}
          onConfirm={(name) => handleRename(dialog.entry, name)}
          onClose={() => setDialog({ type: 'none' })}
        />
      )}
      {dialog.type === 'delete' && (
        <ConfirmDialog
          title="Supprimer"
          message={`Supprimer "${dialog.entry.name}" ? Cette action est irréversible.`}
          onConfirm={() => handleDelete(dialog.entry)}
          onClose={() => setDialog({ type: 'none' })}
        />
      )}
    </div>
  )
}
