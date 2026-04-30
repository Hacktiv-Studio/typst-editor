import { FaCircleExclamation, FaTriangleExclamation, FaFileLines } from 'react-icons/fa6'
import { useAppStore } from '../../store/appStore'

export function ProblemsTab() {
  const { compileErrors, setActiveFile } = useAppStore()

  if (compileErrors.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-[#585b70] text-xs">
        Aucun problème détecté
      </div>
    )
  }

  return (
    <div className="overflow-auto h-full py-1">
      {compileErrors.map((err, i) => (
        <div
          key={i}
          onClick={() => err.file && setActiveFile(err.file)}
          className="flex items-start gap-2.5 px-3 py-1.5 cursor-pointer hover:bg-[#1e1e2e] text-[10px] border-l-2 border-transparent hover:border-l-[#f38ba8] group"
        >
          {err.severity === 'error'
            ? <FaCircleExclamation size={12} className="text-[#f38ba8] mt-0.5 flex-shrink-0" />
            : <FaTriangleExclamation size={12} className="text-[#f9e2af] mt-0.5 flex-shrink-0" />
          }
          <div className="flex-1 min-w-0">
            <div className="text-[#cdd6f4] leading-snug">{err.message}</div>
            <div className="flex items-center gap-1.5 mt-0.5 text-[#585b70]">
              <FaFileLines size={8} />
              <span>{err.file || 'inconnu'}</span>
              {err.line > 0 && <><span className="text-[#45475a]">·</span><span>ligne {err.line}, col {err.col}</span></>}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
