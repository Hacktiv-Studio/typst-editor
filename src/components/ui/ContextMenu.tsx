import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'

export interface ContextMenuItem {
  label: string
  onClick: () => void
  danger?: boolean
}

export type ContextMenuEntry = ContextMenuItem | 'separator'

interface ContextMenuProps {
  x: number
  y: number
  items: ContextMenuEntry[]
  onClose: () => void
}

export function ContextMenu({ x, y, items, onClose }: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleDown(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('mousedown', handleDown)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('mousedown', handleDown)
      document.removeEventListener('keydown', handleKey)
    }
  }, [onClose])

  const style: React.CSSProperties = {
    position: 'fixed',
    top: Math.min(y, window.innerHeight - 200),
    left: Math.min(x, window.innerWidth - 180),
    zIndex: 200,
  }

  return createPortal(
    <div
      ref={menuRef}
      style={style}
      className="bg-[#313244] border border-[#45475a] rounded-lg w-44 shadow-xl overflow-hidden py-1"
    >
      {items.map((item, i) =>
        item === 'separator' ? (
          <div key={i} className="h-px bg-[#45475a] my-1" />
        ) : (
          <button
            key={i}
            onClick={() => { item.onClick(); onClose() }}
            className={`w-full px-3 py-1.5 text-left text-[11px] transition-colors hover:bg-[#45475a] ${
              item.danger ? 'text-[#f38ba8]' : 'text-[#cdd6f4]'
            }`}
          >
            {item.label}
          </button>
        )
      )}
    </div>,
    document.body
  )
}
