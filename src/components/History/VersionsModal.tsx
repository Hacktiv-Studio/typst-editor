import { useState, useEffect, useCallback } from 'react'
import { FaClockRotateLeft, FaXmark, FaRotateLeft, FaEye, FaChevronLeft, FaChevronRight } from 'react-icons/fa6'
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

function VersionPreview({ tmpPath, versionId }: { tmpPath: string; versionId: string }) {
  const [pages, setPages] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(0)
  const svgUrl = useBlobUrl(pages[page] ?? null)

  useEffect(() => {
    setLoading(true)
    setPage(0)
    renderVersionPreview(tmpPath, versionId)
      .then(setPages)
      .catch(() => setPages([]))
      .finally(() => setLoading(false))
  }, [tmpPath, versionId])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-40 text-[#585b70] text-xs">
        Compilation en cours…
      </div>
    )
  }

  if (!svgUrl) {
    return (
      <div className="flex items-center justify-center h-20 text-[#585b70] text-xs">
        Aperçu indisponible
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center gap-2 py-3 px-4 bg-[#11111b]">
      <img src={svgUrl} alt="aperçu" className="w-full max-w-[340px] h-auto shadow-lg bg-white rounded-sm" />
      {pages.length > 1 && (
        <div className="flex items-center gap-3 text-[#585b70] text-[11px]">
          <button
            onClick={() => setPage(p => Math.max(0, p - 1))}
            disabled={page === 0}
            className="hover:text-[#cdd6f4] disabled:opacity-30 transition-colors"
          >
            <FaChevronLeft size={10} />
          </button>
          <span>{page + 1} / {pages.length}</span>
          <button
            onClick={() => setPage(p => Math.min(pages.length - 1, p + 1))}
            disabled={page === pages.length - 1}
            className="hover:text-[#cdd6f4] disabled:opacity-30 transition-colors"
          >
            <FaChevronRight size={10} />
          </button>
        </div>
      )}
    </div>
  )
}

export function VersionsModal({ onClose }: Props) {
  const { tmpPath } = useAppStore()
  const { t } = useTranslation()
  const [versions, setVersions] = useState<VersionInfo[]>([])
  const [loading, setLoading] = useState(false)
  const [confirming, setConfirming] = useState<string | null>(null)
  const [restoring, setRestoring] = useState<string | null>(null)
  const [previewId, setPreviewId] = useState<string | null>(null)

  useEffect(() => {
    if (!tmpPath) return
    setLoading(true)
    listVersions(tmpPath)
      .then(setVersions)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [tmpPath])

  const handleRestore = useCallback(async (id: string) => {
    if (!tmpPath || restoring) return
    setRestoring(id)
    try {
      await restoreVersion(tmpPath, id)
      window.location.reload()
    } catch {
      setRestoring(null)
      setConfirming(null)
    }
  }, [tmpPath, restoring])

  function handleBackdropClick(e: React.MouseEvent) {
    if (e.target === e.currentTarget) onClose()
  }

  function togglePreview(id: string) {
    setPreviewId(prev => prev === id ? null : id)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={handleBackdropClick}
    >
      <div className="bg-[#181825] border border-[#313244] rounded-lg shadow-2xl w-[520px] max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#313244]">
          <div className="flex items-center gap-2 text-[#a6adc8] text-xs font-bold uppercase tracking-widest">
            <FaClockRotateLeft size={11} />
            {t('history.title')}
          </div>
          <button
            onClick={onClose}
            className="text-[#585b70] hover:text-[#cdd6f4] transition-colors"
          >
            <FaXmark size={14} />
          </button>
        </div>

        {/* Auto-save note */}
        <div className="px-4 py-2 border-b border-[#313244]/50 text-[10px] text-[#585b70]">
          {t('history.autoSaveNote')}
        </div>

        {/* Versions list */}
        <div className="flex-1 overflow-y-auto">
          {!tmpPath ? (
            <div className="px-4 py-6 text-sm text-[#585b70] text-center">{t('history.noProject')}</div>
          ) : loading ? (
            <div className="px-4 py-6 text-sm text-[#585b70] text-center">{t('history.loading')}</div>
          ) : versions.length === 0 ? (
            <div className="px-4 py-6 text-sm text-[#585b70] text-center">{t('history.noVersions')}</div>
          ) : (
            versions.map((v) => (
              <div key={v.id} className="border-b border-[#313244]/40">
                {/* Version row */}
                <div className="flex items-center justify-between px-4 py-3 hover:bg-[#1e1e2e] group">
                  <div className="min-w-0 flex-1">
                    <div className="text-[#cdd6f4] text-[13px] font-mono">{v.label}</div>
                    <div className="text-[10px] text-[#585b70] mt-0.5 font-mono">{v.id}</div>
                  </div>

                  <div className="flex items-center gap-1 flex-shrink-0">
                    {/* Preview toggle */}
                    <button
                      onClick={() => togglePreview(v.id)}
                      title="Aperçu"
                      className={`w-7 h-7 flex items-center justify-center rounded transition-colors ${
                        previewId === v.id
                          ? 'text-[#89b4fa]'
                          : 'opacity-0 group-hover:opacity-100 text-[#585b70] hover:text-[#89b4fa]'
                      }`}
                    >
                      <FaEye size={12} />
                    </button>

                    {/* Restore */}
                    {confirming === v.id ? (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setConfirming(null)}
                          disabled={!!restoring}
                          className="text-[11px] text-[#585b70] hover:text-[#cdd6f4] px-2 py-1 rounded transition-colors disabled:opacity-40"
                        >
                          {t('sidebar.cancel')}
                        </button>
                        <button
                          onClick={() => handleRestore(v.id)}
                          disabled={!!restoring}
                          className="text-[11px] bg-[#f38ba8] text-[#11111b] px-3 py-1 rounded font-semibold disabled:opacity-40"
                        >
                          {restoring === v.id ? '…' : t('history.restore')}
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setConfirming(v.id)}
                        title={t('history.restore')}
                        className="opacity-0 group-hover:opacity-100 flex items-center gap-1.5 text-[11px] text-[#585b70] hover:text-[#cdd6f4] transition-all"
                      >
                        <FaRotateLeft size={12} />
                        {t('history.restore')}
                      </button>
                    )}
                  </div>
                </div>

                {/* Expandable preview */}
                {previewId === v.id && tmpPath && (
                  <VersionPreview tmpPath={tmpPath} versionId={v.id} />
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
