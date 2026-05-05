import { useState } from 'react'
import { FaCircle, FaXmark } from 'react-icons/fa6'
import { useAppStore } from '../../store/appStore'
import { writeFile } from '../../tauri/commands'
import { ContextMenu, type ContextMenuEntry } from '../ui/ContextMenu'
import { useTranslation } from '../../i18n/useTranslation'

type MenuState = { path: string; x: number; y: number } | null

export function EditorTabs() {
  const { openFiles, activeFile, setActiveFile, closeFile, markFileSaved, tmpPath } = useAppStore()
  const [menu, setMenu] = useState<MenuState>(null)
  const { t } = useTranslation()

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

  return (
    <>
      <div className="h-[30px] bg-[#181825] border-b border-[#313244] flex items-end overflow-x-auto">
        {openFiles.map((file) => {
          const name = file.path.split('/').pop()
          const isActive = file.path === activeFile
          return (
            <div
              key={file.path}
              onClick={() => setActiveFile(file.path)}
              onAuxClick={(e) => { if (e.button === 1) { e.preventDefault(); closeFile(file.path) } }}
              onContextMenu={(e) => openMenu(e, file.path)}
              className={`flex items-center gap-1.5 px-3 h-full cursor-pointer text-[10px] border-r border-[#313244] flex-shrink-0 ${
                isActive
                  ? 'bg-[#1e1e2e] text-[#cdd6f4] border-t-2 border-t-[#89b4fa]'
                  : 'text-[#585b70] hover:text-[#a6adc8]'
              }`}
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
