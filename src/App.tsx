import { Group as PanelGroup, Panel, Separator as PanelResizeHandle } from 'react-resizable-panels'
import { useEffect, useState } from 'react'
import { Sidebar } from './components/Sidebar'
import { Explorer } from './components/Explorer/Explorer'
import { EditorPanel } from './components/Editor/EditorPanel'
import { PreviewPanel } from './components/Preview/PreviewPanel'
import { DiagnosticsPanel } from './components/Diagnostics/DiagnosticsPanel'
import { ProgressModal } from './components/ProgressModal'
import { useAppStore } from './store/appStore'
import { onProgress } from './tauri/commands'

const PANEL_SIZES_KEY = 'typst-editor-panel-sizes'
const PANEL_DEFAULTS = { explorer: 20, preview: 35, diagnostics: 25 }

function loadPanelSizes() {
  try {
    const stored = localStorage.getItem(PANEL_SIZES_KEY)
    return stored ? { ...PANEL_DEFAULTS, ...JSON.parse(stored) } : PANEL_DEFAULTS
  } catch {
    return PANEL_DEFAULTS
  }
}

function savePanelSize(key: keyof typeof PANEL_DEFAULTS, value: number) {
  try {
    const current = loadPanelSizes()
    localStorage.setItem(PANEL_SIZES_KEY, JSON.stringify({ ...current, [key]: Math.round(value) }))
  } catch {}
}

export default function App() {
  const [panelSizes] = useState(loadPanelSizes)
  const { explorerVisible, previewVisible, diagnosticsVisible, setProgress } = useAppStore()

  useEffect(() => {
    let unlisten: (() => void) | undefined
    onProgress((e) => {
      setProgress({ visible: true, label: e.label, current: e.current, total: e.total })
      if (e.current >= e.total) {
        setTimeout(() => setProgress({ visible: false }), 300)
      }
    }).then((fn) => { unlisten = fn })
    return () => unlisten?.()
  }, [])

  useEffect(() => {
    let unlisten: (() => void) | undefined
    import('@tauri-apps/api/event').then(({ listen }) => {
      listen<string>('open-typz', async (e) => {
        const { openProject } = await import('./tauri/commands')
        const info = await openProject(e.payload)
        useAppStore.getState().setProject(info.tmpPath, e.payload, 'main.typ')
      }).then((fn) => { unlisten = fn })
    })
    return () => unlisten?.()
  }, [])

  return (
    <div className="app-root flex h-screen w-screen overflow-hidden bg-[#11111b] text-[#cdd6f4]">
      <Sidebar />

      <div className="flex flex-col flex-1 min-w-0">
        <PanelGroup orientation="vertical" className="flex-1">
          <Panel defaultSize={75} minSize={20}>
            <PanelGroup orientation="horizontal" resizeTargetMinimumSize={{ coarse: 20, fine: 12 }}>
              {explorerVisible && (
                <Panel
                  defaultSize={panelSizes.explorer}
                  minSize={10}
                  onResize={(s) => savePanelSize('explorer', s.asPercentage)}
                >
                  <Explorer />
                </Panel>
              )}
              {explorerVisible && (
                <PanelResizeHandle className="w-[5px] bg-[#313244] hover:bg-[#89b4fa] transition-colors" />
              )}

              <Panel minSize={15}>
                <EditorPanel />
              </Panel>

              {previewVisible && (
                <PanelResizeHandle className="w-[5px] bg-[#313244] hover:bg-[#89b4fa] transition-colors" />
              )}
              {previewVisible && (
                <Panel
                  defaultSize={panelSizes.preview}
                  minSize={10}
                  onResize={(s) => savePanelSize('preview', s.asPercentage)}
                >
                  <PreviewPanel />
                </Panel>
              )}
            </PanelGroup>
          </Panel>

          {diagnosticsVisible && (
            <PanelResizeHandle className="h-[5px] bg-[#313244] hover:bg-[#89b4fa] transition-colors" />
          )}
          {diagnosticsVisible && (
            <Panel
              defaultSize={panelSizes.diagnostics}
              minSize={10}
              onResize={(s) => savePanelSize('diagnostics', s.asPercentage)}
            >
              <DiagnosticsPanel />
            </Panel>
          )}
        </PanelGroup>
      </div>

      <ProgressModal />
    </div>
  )
}
