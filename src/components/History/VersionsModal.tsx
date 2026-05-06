import { useState, useEffect } from 'react'
import { FaClockRotateLeft, FaXmark, FaRotateLeft, FaEye, FaChevronLeft, FaChevronRight, FaArrowLeft } from 'react-icons/fa6'
import { useTranslation } from '../../i18n/useTranslation'
import { useAppStore } from '../../store/appStore'
import { listVersions, restoreVersion, renderVersionPreview } from '../../tauri/commands'
import type { VersionInfo } from '../../tauri/commands'

interface Props {
  onClose: () => void
}

function useBlobUrl(svg: string | null): string | null {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    if (!svg) { setUrl(null); return }
    const blob = new Blob([svg], { type: 'image/svg+xml' })
    const u = URL.createObjectURL(blob)
    setUrl(u)
    return () => URL.revokeObjectURL(u)
  }, [svg])
  return url
}

// ---------------------------------------------------------------------------
// Preview view
// ---------------------------------------------------------------------------

interface PreviewViewProps {
  tmpPath: string
  version: VersionInfo
  onBack: () => void
  onRestored: () => void
}

function PreviewView({ tmpPath, version, onBack, onRestored }: PreviewViewProps) {
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
        <div className="text-[#585b70] text-[10px] font-mono">{version.id}</div>
      </div>

      {/* Preview area */}
      <div className="flex-1 overflow-auto bg-[#11111b] flex flex-col items-center justify-center gap-4 p-6">
        {loading ? (
          <div className="text-[#585b70] text-xs">Compilation en cours…</div>
        ) : !svgUrl ? (
          <div className="text-[#585b70] text-xs">Aperçu indisponible</div>
        ) : (
          <>
            <img
              src={svgUrl}
              alt="aperçu"
              className="w-full max-w-[400px] h-auto shadow-2xl bg-white rounded-sm"
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

// ---------------------------------------------------------------------------
// List view
// ---------------------------------------------------------------------------

interface ListViewProps {
  tmpPath: string
  onPreview: (v: VersionInfo) => void
  onClose: () => void
}

function ListView({ tmpPath, onPreview, onClose }: ListViewProps) {
  const { t } = useTranslation()
  const [versions, setVersions] = useState<VersionInfo[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setLoading(true)
    listVersions(tmpPath)
      .then(setVersions)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [tmpPath])

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#313244] flex-shrink-0">
        <div className="flex items-center gap-2 text-[#a6adc8] text-xs font-bold uppercase tracking-widest">
          <FaClockRotateLeft size={11} />
          {t('history.title')}
        </div>
        <button onClick={onClose} className="text-[#585b70] hover:text-[#cdd6f4] transition-colors">
          <FaXmark size={14} />
        </button>
      </div>

      {/* Note */}
      <div className="px-4 py-2 border-b border-[#313244]/50 text-[10px] text-[#585b70] flex-shrink-0">
        {t('history.autoSaveNote')}
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="px-4 py-6 text-sm text-[#585b70] text-center">{t('history.loading')}</div>
        ) : versions.length === 0 ? (
          <div className="px-4 py-6 text-sm text-[#585b70] text-center">{t('history.noVersions')}</div>
        ) : (
          versions.map((v) => (
            <div
              key={v.id}
              className="flex items-center justify-between px-4 py-3 border-b border-[#313244]/40 hover:bg-[#1e1e2e] group cursor-pointer"
              onClick={() => onPreview(v)}
            >
              <div className="min-w-0 flex-1">
                <div className="text-[#cdd6f4] text-[13px] font-mono">{v.label}</div>
                <div className="text-[10px] text-[#585b70] mt-0.5 font-mono">{v.id}</div>
              </div>
              <FaEye size={12} className="text-[#585b70] opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
            </div>
          ))
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Modal root
// ---------------------------------------------------------------------------

export function VersionsModal({ onClose }: Props) {
  const { tmpPath } = useAppStore()
  const [previewing, setPreviewing] = useState<VersionInfo | null>(null)

  function handleBackdropClick(e: React.MouseEvent) {
    if (e.target === e.currentTarget) onClose()
  }

  if (!tmpPath) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={handleBackdropClick}
    >
      <div className="bg-[#181825] border border-[#313244] rounded-lg shadow-2xl w-[520px] h-[600px] flex flex-col overflow-hidden">
        {previewing ? (
          <PreviewView
            tmpPath={tmpPath}
            version={previewing}
            onBack={() => setPreviewing(null)}
            onRestored={() => window.location.reload()}
          />
        ) : (
          <ListView
            tmpPath={tmpPath}
            onPreview={setPreviewing}
            onClose={onClose}
          />
        )}
      </div>
    </div>
  )
}
