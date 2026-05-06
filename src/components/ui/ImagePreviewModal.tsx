import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { FaXmark } from 'react-icons/fa6'
import { readFileBase64 } from '../../tauri/commands'

const IMAGE_MIME: Record<string, string> = {
  svg: 'image/svg+xml',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  bmp: 'image/bmp',
  ico: 'image/x-icon',
}

export function isImagePath(path: string): boolean {
  const ext = path.split('.').pop()?.toLowerCase() ?? ''
  return ext in IMAGE_MIME
}

interface Props {
  tmpPath: string
  relPath: string
  onClose: () => void
}

export function ImagePreviewModal({ tmpPath, relPath, onClose }: Props) {
  const [src, setSrc] = useState<string | null>(null)
  const overlayRef = useRef<HTMLDivElement>(null)
  const name = relPath.split('/').pop() ?? relPath
  const ext = relPath.split('.').pop()?.toLowerCase() ?? ''
  const mime = IMAGE_MIME[ext] ?? 'application/octet-stream'

  useEffect(() => {
    readFileBase64(tmpPath, relPath).then((b64) => {
      setSrc(`data:${mime};base64,${b64}`)
    })
  }, [tmpPath, relPath, mime])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return createPortal(
    <div
      ref={overlayRef}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70"
      onMouseDown={(e) => { if (e.target === overlayRef.current) onClose() }}
    >
      <div className="bg-[#1e1e2e] border border-[#45475a] rounded-xl shadow-2xl flex flex-col overflow-hidden max-w-[90vw] max-h-[90vh]">
        <div className="px-4 py-2.5 border-b border-[#313244] flex items-center justify-between gap-4 flex-shrink-0">
          <span className="text-[#cdd6f4] text-sm font-semibold truncate">{name}</span>
          <button
            title="close"
            onClick={onClose}
            className="text-[#585b70] hover:text-[#cdd6f4] transition-colors flex-shrink-0"
          >
            <FaXmark size={13} />
          </button>
        </div>
        <div className="flex-1 overflow-auto p-4 flex items-center justify-center min-h-[200px] min-w-[300px]">
          {src
            ? <img src={src} alt={name} className="max-w-full max-h-[75vh] object-contain" />
            : <span className="text-[#585b70] text-sm">Chargement…</span>
          }
        </div>
      </div>
    </div>,
    document.body
  )
}
