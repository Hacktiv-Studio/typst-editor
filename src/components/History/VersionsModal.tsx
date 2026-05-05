import { useState, useEffect } from 'react'
import { FaClockRotateLeft, FaXmark, FaRotateLeft } from 'react-icons/fa6'
import { useTranslation } from '../../i18n/useTranslation'
import { useAppStore } from '../../store/appStore'
import { listVersions, restoreVersion } from '../../tauri/commands'
import type { VersionInfo } from '../../tauri/commands'

interface Props {
  onClose: () => void
}

export function VersionsModal({ onClose }: Props) {
  const { tmpPath } = useAppStore()
  const { t } = useTranslation()
  const [versions, setVersions] = useState<VersionInfo[]>([])
  const [loading, setLoading] = useState(false)
  const [confirming, setConfirming] = useState<string | null>(null)
  const [restoring, setRestoring] = useState<string | null>(null)

  useEffect(() => {
    if (!tmpPath) return
    setLoading(true)
    listVersions(tmpPath)
      .then(setVersions)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [tmpPath])

  async function handleRestore(id: string) {
    if (!tmpPath || restoring) return
    setRestoring(id)
    try {
      await restoreVersion(tmpPath, id)
      window.location.reload()
    } catch {
      setRestoring(null)
      setConfirming(null)
    }
  }

  function handleBackdropClick(e: React.MouseEvent) {
    if (e.target === e.currentTarget) onClose()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={handleBackdropClick}
    >
      <div className="bg-[#181825] border border-[#313244] rounded-lg shadow-2xl w-[480px] max-h-[70vh] flex flex-col">
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
              <div
                key={v.id}
                className="flex items-center justify-between px-4 py-3 border-b border-[#313244]/40 hover:bg-[#1e1e2e] group"
              >
                <div className="min-w-0 flex-1">
                  <div className="text-[#cdd6f4] text-[13px] font-mono">{v.label}</div>
                  <div className="text-[10px] text-[#585b70] mt-0.5">
                    {(v.size / 1024).toFixed(1)} KB
                  </div>
                </div>

                {confirming === v.id ? (
                  <div className="flex items-center gap-2 flex-shrink-0">
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
                    className="opacity-0 group-hover:opacity-100 flex items-center gap-1.5 text-[11px] text-[#585b70] hover:text-[#89b4fa] transition-all flex-shrink-0"
                  >
                    <FaRotateLeft size={12} />
                    {t('history.restore')}
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
