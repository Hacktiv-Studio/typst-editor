import { useAppStore } from '../../store/appStore'

export function Thumbnails() {
  const { pages, activePage, setActivePage } = useAppStore()

  return (
    <div className="w-[72px] bg-[#181825] border-l border-[#313244] overflow-y-auto flex flex-col items-center gap-2 py-2 flex-shrink-0">
      {pages.map((svg, i) => (
        <div
          key={i}
          onClick={() => setActivePage(i)}
          className={`w-14 cursor-pointer rounded-sm overflow-hidden border-[1.5px] transition-colors flex-shrink-0 ${
            i === activePage ? 'border-[#89b4fa]' : 'border-transparent hover:border-[#45475a]'
          }`}
        >
          <div
            dangerouslySetInnerHTML={{ __html: svg }}
            className="w-full pointer-events-none"
            style={{ transform: 'scale(0.18)', transformOrigin: 'top left', height: '76px', overflow: 'hidden' }}
          />
          <div className={`text-center text-[8px] py-0.5 ${i === activePage ? 'text-[#89b4fa]' : 'text-[#585b70]'}`}>
            {i + 1}
          </div>
        </div>
      ))}
    </div>
  )
}
