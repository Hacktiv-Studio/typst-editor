import { useRef } from 'react'
import { createPortal } from 'react-dom'
import { useEscapeKey } from '../../hooks/useEscapeKey'

interface DialogProps {
  title: string
  children: React.ReactNode
  actions: React.ReactNode
  onClose: () => void
  width?: string
}

export function Dialog({ title, children, actions, onClose, width = 'w-80' }: DialogProps) {
  const overlayRef = useRef<HTMLDivElement>(null)
  useEscapeKey(onClose)

  return createPortal(
    <div
      ref={overlayRef}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60"
      onMouseDown={(e) => { if (e.target === overlayRef.current) onClose() }}
    >
      <div className={`bg-[#1e1e2e] border border-[#45475a] rounded-xl shadow-2xl ${width} overflow-hidden`}>
        <div className="px-4 py-3 border-b border-[#313244] text-[#cdd6f4] text-sm font-semibold">
          {title}
        </div>
        <div className="px-4 py-3">{children}</div>
        <div className="px-4 py-3 border-t border-[#313244] flex justify-end gap-2">
          {actions}
        </div>
      </div>
    </div>,
    document.body
  )
}
