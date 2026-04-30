import { useState } from 'react'
import { FaCircleExclamation, FaTerminal, FaXmark } from 'react-icons/fa6'
import { ProblemsTab } from './ProblemsTab'
import { OutputTab } from './OutputTab'
import { useAppStore } from '../../store/appStore'

type Tab = 'problems' | 'output'

export function DiagnosticsPanel() {
  const [activeTab, setActiveTab] = useState<Tab>('problems')
  const { compileErrors, toggleDiagnostics } = useAppStore()

  return (
    <div className="h-full bg-[#181825] border-t border-[#313244] flex flex-col">
      {/* Tab bar */}
      <div className="h-7 bg-[#11111b] border-b border-[#313244] flex items-center flex-shrink-0">
        {([
          { id: 'problems', icon: <FaCircleExclamation size={10} />, label: 'Problèmes', badge: compileErrors.filter(e => e.severity === 'error').length },
          { id: 'output', icon: <FaTerminal size={10} />, label: 'Sortie', badge: 0 },
        ] as const).map(({ id, icon, label, badge }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`h-full px-3 flex items-center gap-1.5 text-[10px] border-b-2 transition-colors ${
              activeTab === id
                ? 'text-[#cdd6f4] border-[#89b4fa]'
                : 'text-[#585b70] border-transparent hover:text-[#a6adc8]'
            }`}
          >
            {icon}
            {label}
            {badge > 0 && (
              <span className="bg-[#f38ba8] text-[#11111b] text-[8px] font-bold px-1 rounded-full">
                {badge}
              </span>
            )}
          </button>
        ))}
        <button
          onClick={toggleDiagnostics}
          className="ml-auto mr-2 text-[#585b70] hover:text-[#cdd6f4]"
        >
          <FaXmark size={11} />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === 'problems' ? <ProblemsTab /> : <OutputTab />}
      </div>
    </div>
  )
}
