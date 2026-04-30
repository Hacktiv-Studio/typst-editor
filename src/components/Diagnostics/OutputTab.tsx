import { useAppStore } from '../../store/appStore'

export function OutputTab() {
  const { compileOutput } = useAppStore()

  return (
    <div className="h-full overflow-auto p-2 font-mono text-[10px] text-[#a6adc8] leading-relaxed whitespace-pre-wrap">
      {compileOutput || <span className="text-[#585b70]">Aucune sortie</span>}
    </div>
  )
}
