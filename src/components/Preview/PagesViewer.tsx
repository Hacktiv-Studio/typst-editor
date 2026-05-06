import { useRef, useEffect } from 'react'
import { openUrl } from '@tauri-apps/plugin-opener'
import { useAppStore } from '../../store/appStore'
import { useBlobUrls } from '../../lib/useBlobUrls'
import { jumpFromClick } from '../../tauri/commands'

export function PagesViewer() {
  const pages = useAppStore(s => s.pages)
  const activePage = useAppStore(s => s.activePage)
  const zoom = useAppStore(s => s.zoom)
  const tmpPath = useAppStore(s => s.tmpPath)
  const entryFile = useAppStore(s => s.entryFile)
  const setActivePage = useAppStore(s => s.setActivePage)
  const setZoom = useAppStore(s => s.setZoom)
  const setPendingJump = useAppStore(s => s.setPendingJump)
  const containerRef = useRef<HTMLDivElement>(null)
  const programmaticScrollRef = useRef(false)
  const zoomRef = useRef(zoom)
  const blobUrls = useBlobUrls(pages)

  // Keep zoomRef in sync so the ResizeObserver callback can read the latest value
  useEffect(() => { zoomRef.current = zoom }, [zoom])

  // Update --page-width CSS variable directly on the DOM (no React re-render on resize)
  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const update = () => {
      const w = Math.round((el.clientWidth - 32) * zoomRef.current)
      el.style.setProperty('--page-width', `${w}px`)
    }

    update()
    let rafId = 0
    const ro = new ResizeObserver(() => {
      cancelAnimationFrame(rafId)
      rafId = requestAnimationFrame(update)
    })
    ro.observe(el)
    return () => { ro.disconnect(); cancelAnimationFrame(rafId) }
  }, [])

  // Re-apply --page-width when zoom changes
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const w = Math.round((el.clientWidth - 32) * zoom)
    el.style.setProperty('--page-width', `${w}px`)
  }, [zoom])

  // Ctrl+wheel zoom
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    function onWheel(e: WheelEvent) {
      if (!e.ctrlKey) return
      e.preventDefault()
      const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1
      const next = Math.min(3, Math.max(0.25, zoomRef.current * factor))
      setZoom(Math.round(next * 100) / 100)
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [setZoom])

  // Scroll to page when activePage changes (e.g. from thumbnail click)
  useEffect(() => {
    const el = containerRef.current?.querySelector<HTMLElement>(`[data-page="${activePage}"]`)
    if (!el) return
    programmaticScrollRef.current = true
    el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    setTimeout(() => { programmaticScrollRef.current = false }, 600)
  }, [activePage])

  // Update activePage from scroll position
  useEffect(() => {
    const container = containerRef.current
    if (!container || pages.length === 0) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (programmaticScrollRef.current) return
        const best = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0]
        if (best) {
          const idx = parseInt((best.target as HTMLElement).dataset.page ?? '0', 10)
          setActivePage(idx)
        }
      },
      { root: container, threshold: [0.25, 0.5, 0.75] }
    )

    const pageEls = container.querySelectorAll('[data-page]')
    pageEls.forEach((el) => observer.observe(el))
    return () => observer.disconnect()
  }, [pages.length, setActivePage])

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
      <div className="flex-1 overflow-auto bg-[#1a1a2e] flex flex-col items-center py-6 px-4">
        <div className="w-full max-w-[calc(100%-2rem)] shadow-2xl rounded-sm bg-white" style={{ aspectRatio: '1 / 1.414' }} />
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      className="flex-1 overflow-auto bg-[#1a1a2e] flex flex-col items-center gap-8 py-6 px-4"
    >
      {blobUrls.map((url, i) => (
        <div
          key={i}
          data-page={i}
          className={`relative flex-shrink-0 shadow-2xl rounded-sm cursor-pointer ${
            i === activePage ? 'ring-2 ring-[#89b4fa]' : ''
          }`}
          style={{ width: 'var(--page-width)' }}
          onClick={(e) => {
            setActivePage(i)
            if (!e.ctrlKey || !tmpPath) return
            const img = e.currentTarget.querySelector('img')
            if (!img) return
            const rect = img.getBoundingClientRect()
            const xRatio = (e.clientX - rect.left) / rect.width
            const yRatio = (e.clientY - rect.top) / rect.height
            jumpFromClick(tmpPath, entryFile, i, xRatio, yRatio).then((result) => {
              if (!result) return
              if (result.file != null && result.byteOffset != null) {
                setPendingJump({ file: result.file, byteOffset: result.byteOffset })
              } else if (result.url) {
                openUrl(result.url).catch(() => {})
              } else if (result.page != null) {
                setActivePage(result.page)
              }
            }).catch(() => {})
          }}
        >
          {url ? (
            <img
              src={url}
              alt={`Page ${i + 1}`}
              className="w-full h-auto block bg-white"
              draggable={false}
            />
          ) : (
            <div className="w-full bg-white" style={{ aspectRatio: '1 / 1.414' }} />
          )}
          <div className="absolute -bottom-5 left-1/2 -translate-x-1/2 text-[9px] text-[#585b70] whitespace-nowrap">
            Page {i + 1}
          </div>
        </div>
      ))}
    </div>
  )
}
