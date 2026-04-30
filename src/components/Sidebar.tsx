import { useState, useRef, useEffect } from 'react'
import { FaFolderPlus, FaFolderOpen, FaFileExport, FaFilePdf, FaFileImage, FaVectorSquare, FaTerminal } from 'react-icons/fa6'
import { useAppStore } from '../store/appStore'
import { newProject, openProject, exportProject } from '../tauri/commands'
import { open, save } from '@tauri-apps/plugin-dialog'

export function Sidebar() {
  const [exportOpen, setExportOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const { tmpPath, entryFile, toggleDiagnostics, setProject } = useAppStore()

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setExportOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  async function handleNewProject() {
    const name = `projet-${Date.now()}`
    const info = await newProject(name)
    setProject(info.tmpPath, null, 'main.typ')
  }

  async function handleOpenProject() {
    const selected = await open({ filters: [{ name: 'Typst Project', extensions: ['typz'] }] })
    if (!selected) return
    const info = await openProject(selected as string)
    setProject(info.tmpPath, selected as string, 'main.typ')
  }

  async function handleExport(format: 'pdf' | 'png' | 'svg') {
    if (!tmpPath) return
    setExportOpen(false)
    const ext = format === 'pdf' ? 'pdf' : undefined
    const outPath = await save({ filters: ext ? [{ name: format.toUpperCase(), extensions: [ext] }] : [] })
    if (!outPath) return
    await exportProject(tmpPath, entryFile, format, outPath as string)
  }

  return (
    <div className="w-11 bg-[#181825] flex flex-col items-center py-3 gap-3 border-r border-[#313244] flex-shrink-0 relative z-20">
      {/* Logo */}
      <div className="w-7 h-7 bg-[#89b4fa] rounded-md flex items-center justify-center text-[#11111b] font-black text-sm">
        T
      </div>

      {/* Actions */}
      <div className="mt-2 flex flex-col gap-2">
        <button
          title="Nouveau projet"
          onClick={handleNewProject}
          className="w-8 h-8 flex items-center justify-center text-[#585b70] hover:text-[#cdd6f4] hover:bg-[#313244] rounded-md transition-colors"
        >
          <FaFolderPlus size={15} />
        </button>
        <button
          title="Ouvrir un projet"
          onClick={handleOpenProject}
          className="w-8 h-8 flex items-center justify-center text-[#585b70] hover:text-[#cdd6f4] hover:bg-[#313244] rounded-md transition-colors"
        >
          <FaFolderOpen size={15} />
        </button>
      </div>

      {/* Bottom actions */}
      <div className="mt-auto flex flex-col gap-2 items-center" ref={menuRef}>
        {/* Toggle diagnostics */}
        <button
          title="Diagnostics"
          onClick={toggleDiagnostics}
          className="w-8 h-8 flex items-center justify-center text-[#585b70] hover:text-[#cdd6f4] hover:bg-[#313244] rounded-md transition-colors"
        >
          <FaTerminal size={13} />
        </button>

        {/* Export */}
        <div className="relative">
          <button
            title="Exporter"
            onClick={() => setExportOpen((o) => !o)}
            className="w-8 h-8 flex items-center justify-center bg-[#89b4fa] text-[#11111b] rounded-md hover:bg-[#74c7ec] transition-colors"
          >
            <FaFileExport size={15} />
          </button>

          {exportOpen && (
            <div className="absolute left-10 bottom-0 bg-[#313244] border border-[#45475a] rounded-lg w-44 shadow-xl overflow-hidden z-50">
              <div className="px-3 py-1.5 text-[9px] font-bold uppercase tracking-widest text-[#585b70] border-b border-[#45475a]">
                Exporter
              </div>
              {[
                { format: 'pdf' as const, icon: <FaFilePdf />, label: 'PDF', desc: 'Document complet', color: 'text-[#f38ba8]', bg: 'bg-[#f38ba820]' },
                { format: 'png' as const, icon: <FaFileImage />, label: 'PNG', desc: 'Images par page', color: 'text-[#a6e3a1]', bg: 'bg-[#a6e3a120]' },
                { format: 'svg' as const, icon: <FaVectorSquare />, label: 'SVG', desc: 'Vectoriel par page', color: 'text-[#89b4fa]', bg: 'bg-[#89b4fa20]' },
              ].map(({ format, icon, label, desc, color, bg }) => (
                <button
                  key={format}
                  onClick={() => handleExport(format)}
                  className="w-full px-3 py-2 flex items-center gap-2.5 hover:bg-[#45475a] transition-colors text-left"
                >
                  <div className={`w-7 h-7 rounded-md ${bg} ${color} flex items-center justify-center text-sm flex-shrink-0`}>
                    {icon}
                  </div>
                  <div>
                    <div className="text-[#cdd6f4] font-semibold text-[11px]">{label}</div>
                    <div className="text-[#585b70] text-[9px]">{desc}</div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
