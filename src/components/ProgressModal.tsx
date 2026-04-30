import { useAppStore } from '../store/appStore'

export function ProgressModal() {
  const { progress } = useAppStore()
  if (!progress.visible) return null

  const pct = progress.total > 0
    ? Math.round((progress.current / progress.total) * 100)
    : 0

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-[#1e1e2e] border border-[#313244] rounded-xl p-6 w-80 shadow-2xl">
        <p className="text-[#cdd6f4] text-sm font-medium mb-4">{progress.label}</p>
        <div className="w-full bg-[#313244] rounded-full h-2 overflow-hidden">
          <div
            className="bg-[#89b4fa] h-2 rounded-full transition-all duration-150"
            style={{ width: `${pct}%` }}
          />
        </div>
        <p className="text-[#585b70] text-xs mt-2 text-right">
          {progress.current} / {progress.total}
        </p>
      </div>
    </div>
  )
}
