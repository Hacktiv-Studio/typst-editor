import { FaCircle, FaXmark } from 'react-icons/fa6'
import { useAppStore } from '../../store/appStore'

export function OpenFilesList() {
  const { openFiles, activeFile, setActiveFile, closeFile } = useAppStore()

  if (openFiles.length === 0) return null

  return (
    <div>
      <div className="px-2 py-1.5 text-[9px] font-bold uppercase tracking-wider text-[#585b70] flex items-center gap-1">
        Fichiers ouverts
      </div>
      {openFiles.map((file) => (
        <div
          key={file.path}
          onClick={() => setActiveFile(file.path)}
          className={`flex items-center gap-1.5 px-4 py-1 cursor-pointer group text-[10px] ${
            activeFile === file.path
              ? 'bg-[#313244] border-l-2 border-[#89b4fa] pl-[14px] text-[#cdd6f4]'
              : 'text-[#a6adc8] hover:bg-[#313244]/50'
          }`}
        >
          {file.isDirty
            ? <FaCircle size={7} className="text-[#f38ba8] flex-shrink-0" />
            : <FaCircle size={7} className="text-[#a6e3a1] flex-shrink-0" />
          }
          <span className="flex-1 truncate">{file.path.split('/').pop()}</span>
          <button
            onClick={(e) => { e.stopPropagation(); closeFile(file.path) }}
            className="opacity-0 group-hover:opacity-100 text-[#585b70] hover:text-[#cdd6f4] transition-opacity"
          >
            <FaXmark size={9} />
          </button>
        </div>
      ))}
    </div>
  )
}
