import { FaGear, FaXmark } from 'react-icons/fa6'
import { useAppStore } from '../../store/appStore'
import { useTranslation } from '../../i18n/useTranslation'

interface Props {
  onClose: () => void
}

export function SettingsModal({ onClose }: Props) {
  const { language, setLanguage } = useAppStore()
  const { t } = useTranslation()

  function handleBackdropClick(e: React.MouseEvent) {
    if (e.target === e.currentTarget) onClose()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={handleBackdropClick}
    >
      <div className="bg-[#181825] border border-[#313244] rounded-lg shadow-2xl w-[420px] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#313244]">
          <div className="flex items-center gap-2 text-[#a6adc8] text-xs font-bold uppercase tracking-widest">
            <FaGear size={11} />
            {t('settings.title')}
          </div>
          <button
            title="close"
            onClick={onClose}
            className="text-[#585b70] hover:text-[#cdd6f4] transition-colors"
          >
            <FaXmark size={14} />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 flex flex-col gap-5">
          {/* Section Interface */}
          <div>
            <div className="text-[9px] font-bold uppercase tracking-widest text-[#585b70] mb-3">
              {t('settings.sectionInterface')}
            </div>

            {/* Language */}
            <div className="flex items-center justify-between py-2 border-b border-[#313244]/50">
              <span className="text-sm text-[#a6adc8]">{t('settings.language')}</span>
              <div className="flex gap-1">
                <button
                  onClick={() => setLanguage('fr')}
                  className={`px-3 py-1 rounded text-xs font-semibold transition-colors ${
                    language === 'fr'
                      ? 'bg-[#89b4fa] text-[#11111b]'
                      : 'text-[#585b70] hover:text-[#cdd6f4] hover:bg-[#313244]'
                  }`}
                >
                  {t('settings.langFr')}
                </button>
                <button
                  onClick={() => setLanguage('en')}
                  className={`px-3 py-1 rounded text-xs font-semibold transition-colors ${
                    language === 'en'
                      ? 'bg-[#89b4fa] text-[#11111b]'
                      : 'text-[#585b70] hover:text-[#cdd6f4] hover:bg-[#313244]'
                  }`}
                >
                  {t('settings.langEn')}
                </button>
              </div>
            </div>
          </div>

          {/* Section Compilation */}
          <div>
            <div className="text-[9px] font-bold uppercase tracking-widest text-[#585b70] mb-3">
              {t('settings.sectionCompilation')}
            </div>
            <div className="py-2 text-xs text-[#45475a] italic">
              {t('settings.comingSoon')}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
