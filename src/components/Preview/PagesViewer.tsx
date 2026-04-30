import { useRef } from 'react'
import { useAppStore } from '../../store/appStore'

export function PagesViewer() {
  const { pages, activePage, zoom, setActivePage } = useAppStore()
  const containerRef = useRef<HTMLDivElement>(null)

  return (
    <div
      ref={containerRef}
      className="flex-1 overflow-auto bg-[#1a1a2e] flex flex-col items-center gap-4 py-5 px-4"
    >
      {pages.length === 0 && (
        <div className="flex-1 flex items-center justify-center text-[#585b70] text-sm">
          Aucun aperçu — compilez un fichier .typ
        </div>
      )}
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
