// src/components/History/PreviewView.tsx
import { useState, useEffect } from 'react'
import {
  FaArrowLeft, FaExpand, FaCompress,
  FaChevronLeft, FaChevronRight, FaRotateLeft,
} from 'react-icons/fa6'
import { useTranslation } from '../../i18n/useTranslation'
import { renderVersionPreview, restoreVersion } from '../../tauri/commands'
import { useBlobUrl } from '../../lib/useBlobUrls'
import type { VersionInfo } from '../../tauri/commands'

interface Props {
  tmpPath: string
  version: VersionInfo
  fullscreen: boolean
  onToggleFullscreen: () => void
  onBack: () => void
  onRestored: () => void
}

export function PreviewView({ tmpPath, version, fullscreen, onToggleFullscreen, onBack, onRestored }: Props) {
  const { t } = useTranslation()
  const [pages, setPages] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(0)
  const [confirming, setConfirming] = useState(false)
  const [restoring, setRestoring] = useState(false)
  const svgUrl = useBlobUrl(pages[page] ?? null)

  useEffect(() => {
    setLoading(true)
    setPage(0)
    renderVersionPreview(tmpPath, version.id)
      .then(setPages)
      .catch(() => setPages([]))
      .finally(() => setLoading(false))
  }, [tmpPath, version.id])

  async function handleRestore() {
    setRestoring(true)
    try {
      await restoreVersion(tmpPath, version.id)
      onRestored()
    } catch {
      setRestoring(false)
      setConfirming(false)
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#313244] flex-shrink-0">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-[#585b70] hover:text-[#cdd6f4] transition-colors text-xs"
        >
          <FaArrowLeft size={11} />
          Retour
        </button>
        <div className="text-[#cdd6f4] text-[13px] font-mono">{version.label}</div>
        <div className="flex items-center gap-3">
          <div className="text-[#585b70] text-[10px] font-mono">{version.id}</div>
          <button
            onClick={onToggleFullscreen}
            className="text-[#585b70] hover:text-[#cdd6f4] transition-colors"
            title={fullscreen ? 'Réduire' : 'Plein écran'}
          >
            {fullscreen ? <FaCompress size={12} /> : <FaExpand size={12} />}
          </button>
        </div>
      </div>

      {/* Preview area */}
      <div className="flex-1 overflow-auto bg-[#11111b] flex flex-col items-center justify-center gap-4 p-6">
        {loading ? (
          <div className="text-[#585b70] text-xs">Compilation en cours…</div>
        ) : pages.length === 0 ? (
          <div className="w-full max-w-[400px] shadow-2xl bg-white rounded-sm" style={{ aspectRatio: '1 / 1.414' }} />
        ) : !svgUrl ? (
          <div className="text-[#585b70] text-xs">Aperçu indisponible</div>
        ) : (
          <>
            <img
              src={svgUrl}
              alt="aperçu"
              className="w-full max-w-[520px] h-auto shadow-2xl bg-white rounded-sm"
            />
            {pages.length > 1 && (
              <div className="flex items-center gap-3 text-[#585b70] text-[11px]">
                <button
                  onClick={() => setPage(p => Math.max(0, p - 1))}
                  disabled={page === 0}
                  className="hover:text-[#cdd6f4] disabled:opacity-30 transition-colors"
                >
                  <FaChevronLeft size={10} />
                </button>
                <span>Page {page + 1} / {pages.length}</span>
                <button
                  onClick={() => setPage(p => Math.min(pages.length - 1, p + 1))}
                  disabled={page === pages.length - 1}
                  className="hover:text-[#cdd6f4] disabled:opacity-30 transition-colors"
                >
                  <FaChevronRight size={10} />
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Footer — restore */}
      <div className="px-4 py-3 border-t border-[#313244] flex items-center justify-end gap-3 flex-shrink-0">
        {confirming ? (
          <>
            <button
              onClick={() => setConfirming(false)}
              disabled={restoring}
              className="text-[12px] text-[#585b70] hover:text-[#cdd6f4] px-3 py-1.5 rounded transition-colors disabled:opacity-40"
            >
              {t('sidebar.cancel')}
            </button>
            <button
              onClick={handleRestore}
              disabled={restoring}
              className="text-[12px] bg-[#f38ba8] text-[#11111b] px-4 py-1.5 rounded font-semibold disabled:opacity-40"
            >
              {restoring ? '…' : t('history.restore')}
            </button>
          </>
        ) : (
          <button
            onClick={() => setConfirming(true)}
            className="flex items-center gap-2 text-[12px] text-[#585b70] hover:text-[#cdd6f4] border border-[#313244] hover:border-[#585b70] px-4 py-1.5 rounded transition-colors"
          >
            <FaRotateLeft size={11} />
            {t('history.restore')}
          </button>
        )}
      </div>
    </div>
  )
}
