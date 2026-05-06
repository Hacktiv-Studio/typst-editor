// src/components/History/VersionsModal.tsx
import { useState, useRef } from 'react'
import { useAppStore } from '../../store/appStore'
import { invalidateCompileHashes } from '../../tauri/commands'
import type { VersionInfo } from '../../tauri/commands'
import { PreviewView } from './PreviewView'
import { ListView } from './ListView'

interface Props {
  onClose: () => void
}

const MIN_W = 380
const MIN_H = 400
const DEFAULT_W = 520
const DEFAULT_H = 600

export function VersionsModal({ onClose }: Props) {
  const { tmpPath } = useAppStore()
  const [previewing, setPreviewing] = useState<VersionInfo | null>(null)
  const [fullscreen, setFullscreen] = useState(false)
  const [size, setSize] = useState({ w: DEFAULT_W, h: DEFAULT_H })
  const [resizing, setResizing] = useState(false)
  const sizeRef = useRef(size)
  sizeRef.current = size

  function handleBackdropClick(e: React.MouseEvent) {
    if (e.target === e.currentTarget) onClose()
  }

  function startResize(e: React.MouseEvent) {
    if (fullscreen) return
    e.preventDefault()
    e.stopPropagation()
    setResizing(true)
    const startX = e.clientX
    const startY = e.clientY
    const startW = sizeRef.current.w
    const startH = sizeRef.current.h

    function onMove(ev: MouseEvent) {
      setSize({
        w: Math.max(MIN_W, startW + ev.clientX - startX),
        h: Math.max(MIN_H, startH + ev.clientY - startY),
      })
    }
    function onUp() {
      setResizing(false)
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  if (!tmpPath) return null

  const modalStyle = fullscreen
    ? { width: '100vw', height: '100vh' }
    : { width: size.w, height: size.h }

  return (
    <>
      {resizing && <div className="fixed inset-0 z-[60] cursor-se-resize" />}
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
        onClick={handleBackdropClick}
      >
        <div
          className={`bg-[#181825] border border-[#313244] shadow-2xl flex flex-col overflow-hidden relative${fullscreen ? '' : ' rounded-lg'}`}
          style={modalStyle}
          onClick={e => e.stopPropagation()}
        >
          {previewing ? (
            <PreviewView
              tmpPath={tmpPath}
              version={previewing}
              fullscreen={fullscreen}
              onToggleFullscreen={() => setFullscreen(f => !f)}
              onBack={() => setPreviewing(null)}
              onRestored={async () => {
                await invalidateCompileHashes(tmpPath)
                window.location.reload()
              }}
            />
          ) : (
            <ListView
              tmpPath={tmpPath}
              fullscreen={fullscreen}
              onToggleFullscreen={() => setFullscreen(f => !f)}
              onPreview={setPreviewing}
              onClose={onClose}
            />
          )}

          {/* Resize handle — bottom-right corner */}
          {!fullscreen && (
            <div
              className="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize"
              onMouseDown={startResize}
              style={{
                background: 'linear-gradient(135deg, transparent 50%, #585b70 50%)',
                borderBottomRightRadius: 8,
              }}
            />
          )}
        </div>
      </div>
    </>
  )
}
