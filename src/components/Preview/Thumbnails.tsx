import { useAppStore } from '../../store/appStore'

export function Thumbnails() {
  const { pages, activePage, setActivePage } = useAppStore()

  return (
    <div className="w-[88px] bg-[#181825] border-l border-[#313244] overflow-y-auto flex flex-col items-center gap-2.5 py-3 flex-shrink-0">
      {pages.map((svg, i) => (
        <button
          key={i}
          onClick={() => setActivePage(i)}
          className={`w-[64px] rounded overflow-hidden border-2 transition-all flex-shrink-0 ${
            i === activePage
              ? 'border-[#89b4fa] shadow-lg shadow-[#89b4fa]/20'
              : 'border-[#313244] hover:border-[#45475a]'
          }`}
        >
          <img
            src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`}
            alt={`Page ${i + 1}`}
            className="w-full h-auto block"
            draggable={false}
          />
          <div className={`text-center text-[9px] py-0.5 bg-[#181825] ${
            i === activePage ? 'text-[#89b4fa]' : 'text-[#585b70]'
          }`}>
            {i + 1}
          </div>
        </button>
      ))}
    </div>
  )
}
