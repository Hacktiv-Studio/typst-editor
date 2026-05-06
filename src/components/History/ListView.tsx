// src/components/History/ListView.tsx
import { useState, useEffect } from 'react'
import { FaClockRotateLeft, FaXmark, FaEye, FaExpand, FaCompress } from 'react-icons/fa6'
import { useTranslation } from '../../i18n/useTranslation'
import { listVersions } from '../../tauri/commands'
import type { VersionInfo } from '../../tauri/commands'

interface Props {
  tmpPath: string
  fullscreen: boolean
  onToggleFullscreen: () => void
  onPreview: (v: VersionInfo) => void
  onClose: () => void
}

export function ListView({ tmpPath, fullscreen, onToggleFullscreen, onPreview, onClose }: Props) {
  const { t } = useTranslation()
  const [versions, setVersions] = useState<VersionInfo[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)

  useEffect(() => {
    setLoading(true)
    setError(false)
    listVersions(tmpPath)
      .then(setVersions)
      .catch(() => setError(true))
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
        <div className="flex items-center gap-3">
          <button
            onClick={onToggleFullscreen}
            className="text-[#585b70] hover:text-[#cdd6f4] transition-colors"
            title={fullscreen ? 'Réduire' : 'Plein écran'}
          >
            {fullscreen ? <FaCompress size={12} /> : <FaExpand size={12} />}
          </button>
          <button onClick={onClose} className="text-[#585b70] hover:text-[#cdd6f4] transition-colors">
            <FaXmark size={14} />
          </button>
        </div>
      </div>

      {/* Note */}
      <div className="px-4 py-2 border-b border-[#313244]/50 text-[10px] text-[#585b70] flex-shrink-0">
        {t('history.autoSaveNote')}
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="px-4 py-6 text-sm text-[#585b70] text-center">{t('history.loading')}</div>
        ) : error ? (
          <div className="px-4 py-6 text-sm text-[#f38ba8] text-center">{t('history.loadError')}</div>
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
