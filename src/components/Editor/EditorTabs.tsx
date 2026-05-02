import { FaCircle, FaXmark } from 'react-icons/fa6'
import { useAppStore } from '../../store/appStore'

export function EditorTabs() {
  const { openFiles, activeFile, setActiveFile, closeFile } = useAppStore()

  if (openFiles.length === 0) return (
    <div className="h-[30px] bg-[#181825] border-b border-[#313244]" />
  )

  return (
    <div className="h-[30px] bg-[#181825] border-b border-[#313244] flex items-end overflow-x-auto">
      {openFiles.map((file) => {
        const name = file.path.split('/').pop()
        const isActive = file.path === activeFile
        return (
          <div
            key={file.path}
            onClick={() => setActiveFile(file.path)}
            onAuxClick={(e) => { if (e.button === 1) { e.preventDefault(); closeFile(file.path) } }}
            className={`flex items-center gap-1.5 px-3 h-full cursor-pointer text-[10px] border-r border-[#313244] flex-shrink-0 ${
              isActive
                ? 'bg-[#1e1e2e] text-[#cdd6f4] border-t-2 border-t-[#89b4fa]'
                : 'text-[#585b70] hover:text-[#a6adc8]'
            }`}
          >
            {file.isDirty && <FaCircle size={7} className="text-[#f38ba8]" />}
            <span>{name}</span>
            <button
              onClick={(e) => { e.stopPropagation(); closeFile(file.path) }}
              className="hover:text-[#cdd6f4] ml-1 opacity-60 hover:opacity-100"
            >
              <FaXmark size={9} />
            </button>
          </div>
        )
      })}
    </div>
  )
}
