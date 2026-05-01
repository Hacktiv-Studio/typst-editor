import { useRef } from 'react'
import { useAppStore } from '../../store/appStore'

export function PagesViewer() {
  const { pages, activePage, zoom, setActivePage, tmpPath } = useAppStore()
  const containerRef = useRef<HTMLDivElement>(null)

  if (!tmpPath) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-[#585b70] gap-3">
        <div className="w-12 h-12 rounded-xl bg-[#313244] flex items-center justify-center text-[#89b4fa] text-2xl font-black">
          T
        </div>
        <div className="text-center">
          <div className="text-sm text-[#a6adc8]">Aucun projet ouvert</div>
          <div className="text-xs mt-1">Créez ou ouvrez un projet depuis la barre latérale</div>
        </div>
      </div>
    )
  }

  if (pages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-[#585b70] text-sm">
        Page blanche — écrivez du contenu pour voir l'aperçu
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      className="flex-1 overflow-auto bg-[#1a1a2e] flex flex-col items-center gap-4 py-5 px-4"
    >
      {pages.map((svg, i) => (
        <div
          key={i}
          data-page={i}
          className={`relative flex-shrink-0 shadow-2xl rounded-sm cursor-pointer transition-shadow ${
            i === activePage ? 'ring-2 ring-[#89b4fa]' : ''
          }`}
          style={{ transform: `scale(${zoom})`, transformOrigin: 'top center' }}
          onClick={() => setActivePage(i)}
        >
          <div
            dangerouslySetInnerHTML={{ __html: svg }}
            className="bg-white block"
            style={{ lineHeight: 0 }}
          />
          <div className="absolute -bottom-5 left-1/2 -translate-x-1/2 text-[9px] text-[#585b70] whitespace-nowrap">
            Page {i + 1}
          </div>
        </div>
      ))}
    </div>
  )
}
