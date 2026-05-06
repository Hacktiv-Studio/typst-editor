import { useState, useCallback, useRef, useEffect } from 'react'
import {
  FaChevronRight, FaChevronDown,
  FaFolder, FaFolderOpen, FaFileLines,
} from 'react-icons/fa6'
import { useAppStore } from '../../store/appStore'
import {
  readFile, createFile, createFolder, listProject,
  renamePath, deletePath, importFile, importFolder, importPath,
} from '../../tauri/commands'
import { listen } from '@tauri-apps/api/event'
import { open as openDialog } from '@tauri-apps/plugin-dialog'
import type { ProjectEntry } from '../../types'
import { InputDialog } from '../ui/InputDialog'
import { ConfirmDialog } from '../ui/ConfirmDialog'
import { ContextMenu, type ContextMenuEntry } from '../ui/ContextMenu'
import { ImagePreviewModal, isImagePath } from '../ui/ImagePreviewModal'

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
  onDragStart,
  draggedPath,
  dragOverPath,
}: {
  entry: ProjectEntry
  depth?: number
  onContextMenu: (e: React.MouseEvent, entry: ProjectEntry) => void
  onDragStart: (path: string, x: number, y: number) => void
  draggedPath: string | null
  dragOverPath: string | null
}) {
  const [open, setOpen] = useState(depth === 0)
  const { tmpPath, openFile, activeFile } = useAppStore()

  async function handleFileClick() {
    if (!tmpPath) return
    const content = await readFile(tmpPath, entry.path)
    openFile({ path: entry.path, content, isDirty: false })
  }

  const isActive = !entry.isDir && entry.path === activeFile
  const isDragTarget = entry.isDir && dragOverPath === entry.path
  const isBeingDragged = draggedPath === entry.path

  return (
    <div>
      <div
        data-path={entry.path}
        data-isdir={entry.isDir ? 'true' : 'false'}
        onPointerDown={(e) => {
          if (e.button !== 0) return
          e.stopPropagation()
          onDragStart(entry.path, e.clientX, e.clientY)
        }}
        onClick={() => {
          if (entry.isDir) setOpen((o) => !o)
          else handleFileClick()
        }}
        onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); onContextMenu(e, entry) }}
        className={`flex items-center gap-1.5 py-1 cursor-pointer text-[#a6adc8] text-xs select-none transition-colors ${
          isDragTarget
            ? 'bg-[#45475a] outline outline-1 outline-[#89b4fa]'
            : isActive
              ? 'bg-[#313244]'
              : 'hover:bg-[#313244]/50'
        } ${isBeingDragged ? 'opacity-40' : ''}`}
        style={{ paddingLeft: `${16 + depth * 12}px` }}
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
        <TreeNode
          key={child.path}
          entry={child}
          depth={depth + 1}
          onContextMenu={onContextMenu}
          onDragStart={onDragStart}
          draggedPath={draggedPath}
          dragOverPath={dragOverPath}
        />
      ))}
    </div>
  )
}

const DRAG_THRESHOLD = 5

export function FileTree() {
  const { projectTree, tmpPath, setProjectTree, renameOpenFile } = useAppStore()
  const [dialog, setDialog] = useState<DialogState>({ type: 'none' })
  const [menu, setMenu] = useState<MenuState>({ type: 'none' })
  const [draggedPath, setDraggedPath] = useState<string | null>(null)
  const [dragOverPath, setDragOverPath] = useState<string | null>(null)
  const [externalDrag, setExternalDrag] = useState(false)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const startPosRef = useRef({ x: 0, y: 0 })
  const didMoveRef = useRef(false)
  const zoomRef = useRef(1)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey) return
      e.preventDefault()
      const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1
      const next = Math.min(2, Math.max(0.5, zoomRef.current * factor))
      zoomRef.current = next
      el.style.zoom = String(next)
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])

  useEffect(() => {
    if (!tmpPath) return
    const unlisteners: Array<() => void> = []

    listen<{ paths: string[] }>('tauri://drag-enter', () => {
      setExternalDrag(true)
    }).then((u) => unlisteners.push(u))

    listen<{ paths: string[] }>('tauri://drag-leave', () => {
      setExternalDrag(false)
    }).then((u) => unlisteners.push(u))

    listen<{ paths: string[] }>('tauri://drag-drop', async (e) => {
      setExternalDrag(false)
      for (const srcPath of e.payload.paths) {
        await importPath(tmpPath, srcPath).catch(() => {})
      }
      const tree = await listProject(tmpPath)
      setProjectTree(tree)
    }).then((u) => unlisteners.push(u))

    return () => unlisteners.forEach((u) => u())
  }, [tmpPath, setProjectTree])

  // Find which folder the pointer is over. Returns '' for root, null for outside tree.
  function findDropTarget(x: number, y: number): string | null {
    const el = document.elementFromPoint(x, y)
    if (!el || !containerRef.current?.contains(el)) return null
    let node: Element | null = el
    while (node && node !== containerRef.current) {
      if (node.getAttribute('data-isdir') === 'true') {
        return node.getAttribute('data-path') ?? ''
      }
      node = node.parentElement
    }
    return ''  // inside tree but not on a folder row — treat as root
  }

  useEffect(() => {
    if (!draggedPath) return

    function onMove(e: PointerEvent) {
      const dx = e.clientX - startPosRef.current.x
      const dy = e.clientY - startPosRef.current.y
      if (!didMoveRef.current && Math.sqrt(dx * dx + dy * dy) > DRAG_THRESHOLD) {
        didMoveRef.current = true
      }
      if (didMoveRef.current) {
        setDragOverPath(findDropTarget(e.clientX, e.clientY))
      }
    }

    function onUp(e: PointerEvent) {
      if (didMoveRef.current) {
        const target = findDropTarget(e.clientX, e.clientY)
        if (target !== null && draggedPath) {
          handleMove(draggedPath, target)
        }
      }
      setDraggedPath(null)
      setDragOverPath(null)
    }

    document.addEventListener('pointermove', onMove)
    document.addEventListener('pointerup', onUp)
    return () => {
      document.removeEventListener('pointermove', onMove)
      document.removeEventListener('pointerup', onUp)
    }
  }, [draggedPath])

  function handleDragStart(path: string, x: number, y: number) {
    startPosRef.current = { x, y }
    didMoveRef.current = false
    setDraggedPath(path)
  }

  const refreshTree = useCallback(async () => {
    if (!tmpPath) return
    const tree = await listProject(tmpPath)
    setProjectTree(tree)
  }, [tmpPath, setProjectTree])

  async function handleMove(srcPath: string, destDir: string) {
    if (!tmpPath) return
    const name = srcPath.split('/').pop()!
    const newPath = destDir ? `${destDir}/${name}` : name
    const currentDir = srcPath.includes('/') ? srcPath.substring(0, srcPath.lastIndexOf('/')) : ''
    if (currentDir === destDir) return
    if (srcPath === destDir || destDir.startsWith(srcPath + '/')) return
    await renamePath(tmpPath, srcPath, newPath)
    renameOpenFile(srcPath, newPath)
    await refreshTree()
  }

  function openEntryMenu(e: React.MouseEvent, entry: ProjectEntry) {
    setMenu({ type: 'entry', x: e.clientX, y: e.clientY, entry })
  }

  function openBackgroundMenu(e: React.MouseEvent) {
    e.preventDefault()
    setMenu({ type: 'background', x: e.clientX, y: e.clientY, parentDir: '' })
  }

  async function handleCreateFile(parentDir: string, name: string) {
    if (!tmpPath) return
    const finalName = name.includes('.') ? name : `${name}.typ`
    const rel = parentDir ? `${parentDir}/${finalName}` : finalName
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
    renameOpenFile(entry.path, newRel)
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
    const previewItems: ContextMenuEntry[] = (!entry.isDir && isImagePath(entry.path)) ? [
      { label: 'Aperçu', onClick: () => setImagePreview(entry.path) },
      'separator',
    ] : []
    const dirItems: ContextMenuEntry[] = entry.isDir ? [
      { label: 'Nouveau fichier', onClick: () => setDialog({ type: 'newFile', parentDir: entry.path }) },
      { label: 'Nouveau dossier', onClick: () => setDialog({ type: 'newFolder', parentDir: entry.path }) },
      'separator',
      { label: 'Importer un fichier', onClick: () => handleImportFile(entry.path) },
      { label: 'Importer un dossier', onClick: () => handleImportFolder(entry.path) },
      'separator',
    ] : []
    return [
      ...previewItems,
      ...dirItems,
      { label: 'Renommer', onClick: () => setDialog({ type: 'rename', entry }) },
      'separator',
      { label: 'Supprimer', onClick: () => setDialog({ type: 'delete', entry }), danger: true },
    ]
  }

  return (
    <div
      ref={containerRef}
      data-path=""
      data-isdir="true"
      className={`relative flex-1 overflow-auto transition-colors ${
        draggedPath && dragOverPath === '' ? 'bg-[#313244]/30' : ''
      } ${draggedPath ? 'select-none' : ''}`}
      onContextMenu={openBackgroundMenu}
    >
      <div className="px-2 py-1.5 text-[9px] font-bold uppercase tracking-wider text-[#585b70]">
        Projet
      </div>

      {projectTree.map((entry) => (
        <TreeNode
          key={entry.path}
          entry={entry}
          onContextMenu={openEntryMenu}
          onDragStart={handleDragStart}
          draggedPath={draggedPath}
          dragOverPath={dragOverPath}
        />
      ))}

      <div className="min-h-[60px]" />

      {externalDrag && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-[#1e1e2e]/80 border-2 border-dashed border-[#89b4fa] rounded-lg pointer-events-none m-1">
          <div className="text-[#89b4fa] text-xs font-semibold">Déposer ici</div>
          <div className="text-[#585b70] text-[10px]">Fichiers et dossiers</div>
        </div>
      )}

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
      {imagePreview && tmpPath && (
        <ImagePreviewModal
          tmpPath={tmpPath}
          relPath={imagePreview}
          onClose={() => setImagePreview(null)}
        />
      )}
    </div>
  )
}
