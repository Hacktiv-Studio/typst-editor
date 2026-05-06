import { useEffect, useRef, useState } from 'react'
import { FaCircle, FaXmark } from 'react-icons/fa6'
import { useAppStore } from '../../store/appStore'
import { writeFile } from '../../tauri/commands'
import { ContextMenu, type ContextMenuEntry } from '../ui/ContextMenu'
import { useTranslation } from '../../i18n/useTranslation'

type MenuState = { path: string; x: number; y: number } | null
type DragState = { fromIndex: number } | null

const DRAG_THRESHOLD = 5

export function EditorTabs() {
  const { openFiles, activeFile, setActiveFile, closeFile, markFileSaved, tmpPath, reorderFiles } = useAppStore()
  const [menu, setMenu] = useState<MenuState>(null)
  const [dragState, setDragState] = useState<DragState>(null)
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)
  const startXRef = useRef(0)
  const didMoveRef = useRef(false)
  const tabRefs = useRef<(HTMLDivElement | null)[]>([])
  const { t } = useTranslation()

  function getDropIndex(clientX: number): number {
    for (let i = 0; i < tabRefs.current.length; i++) {
      const el = tabRefs.current[i]
      if (!el) continue
      const rect = el.getBoundingClientRect()
      if (clientX < rect.left + rect.width / 2) return i
    }
    return Math.max(0, openFiles.length - 1)
  }

  useEffect(() => {
    if (!dragState) return

    function onMove(e: PointerEvent) {
      if (Math.abs(e.clientX - startXRef.current) > DRAG_THRESHOLD) {
        didMoveRef.current = true
      }
      if (didMoveRef.current) {
        setDragOverIndex(getDropIndex(e.clientX))
      }
    }

    function onUp(e: PointerEvent) {
      if (didMoveRef.current && dragState) {
        const toIndex = getDropIndex(e.clientX)
        if (toIndex !== dragState.fromIndex) {
          reorderFiles(dragState.fromIndex, toIndex)
        }
      }
      setDragState(null)
      setDragOverIndex(null)
    }

    document.addEventListener('pointermove', onMove)
    document.addEventListener('pointerup', onUp)
    return () => {
      document.removeEventListener('pointermove', onMove)
      document.removeEventListener('pointerup', onUp)
    }
  }, [dragState, reorderFiles])

  if (openFiles.length === 0) return (
    <div className="h-[30px] bg-[#181825] border-b border-[#313244]" />
  )

  function openMenu(e: React.MouseEvent, path: string) {
    e.preventDefault()
    setMenu({ path, x: e.clientX, y: e.clientY })
  }

  async function handleSave(path: string) {
    if (!tmpPath) return
    const file = openFiles.find((f) => f.path === path)
    if (!file) return
    await writeFile(tmpPath, path, file.content)
    markFileSaved(path)
  }

  function handleCloseOthers(path: string) {
    openFiles.filter((f) => f.path !== path).forEach((f) => closeFile(f.path))
  }

  function menuItems(path: string): ContextMenuEntry[] {
    return [
      { label: t('tabs.save'), onClick: () => handleSave(path) },
      'separator',
      { label: t('tabs.close'), onClick: () => closeFile(path) },
      { label: t('tabs.closeOthers'), onClick: () => handleCloseOthers(path) },
      { label: t('tabs.closeAll'), onClick: () => openFiles.forEach((f) => closeFile(f.path)) },
    ]
  }

  const isDragging = dragState !== null && didMoveRef.current

  return (
    <>
      <div
        className="h-[30px] bg-[#181825] border-b border-[#313244] flex items-end overflow-x-auto"
        style={{ cursor: isDragging ? 'grabbing' : undefined }}
      >
        {openFiles.map((file, index) => {
          const name = file.path.split('/').pop()
          const isActive = file.path === activeFile
          const isDragTarget = dragOverIndex !== null && dragOverIndex === index && dragState?.fromIndex !== index
          return (
            <div
              key={file.path}
              ref={el => { tabRefs.current[index] = el }}
              onPointerDown={(e) => {
                if (e.button !== 0) return
                startXRef.current = e.clientX
                didMoveRef.current = false
                setDragState({ fromIndex: index })
              }}
              onClick={() => {
                if (!didMoveRef.current) setActiveFile(file.path)
              }}
              onAuxClick={(e) => { if (e.button === 1) { e.preventDefault(); closeFile(file.path) } }}
              onContextMenu={(e) => openMenu(e, file.path)}
              className={`select-none flex items-center gap-1.5 px-3 h-full text-[10px] border-r border-[#313244] flex-shrink-0 ${
                isDragging ? '' : 'cursor-pointer'
              } ${
                isActive
                  ? 'bg-[#1e1e2e] text-[#cdd6f4] border-t-2 border-t-[#89b4fa]'
                  : 'text-[#585b70] hover:text-[#a6adc8]'
              } ${isDragTarget ? 'border-l-2 border-l-[#89b4fa]' : ''}`}
            >
              {file.isDirty && <FaCircle size={7} className="text-[#f38ba8]" />}
              <span>{name}</span>
              <button
                onClick={(e) => { e.stopPropagation(); closeFile(file.path) }}
                className="hover:text-[#cdd6f4] ml-1 opacity-60 hover:opacity-100"
              >
                <FaXmark size={9} />
              </button>
            </div>
          )
        })}
      </div>

      {menu && (
        <ContextMenu
          x={menu.x}
          y={menu.y}
          items={menuItems(menu.path)}
          onClose={() => setMenu(null)}
        />
      )}
    </>
  )
}
