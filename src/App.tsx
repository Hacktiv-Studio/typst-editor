import { Group as PanelGroup, Panel, Separator as PanelResizeHandle } from 'react-resizable-panels'
import { useEffect } from 'react'
import { Sidebar } from './components/Sidebar'
import { Explorer } from './components/Explorer/Explorer'
import { EditorPanel } from './components/Editor/EditorPanel'
import { PreviewPanel } from './components/Preview/PreviewPanel'
import { DiagnosticsPanel } from './components/Diagnostics/DiagnosticsPanel'
import { ProgressModal } from './components/ProgressModal'
import { useAppStore } from './store/appStore'
import { onProgress } from './tauri/commands'

export default function App() {
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
          <Panel defaultSize={75} minSize={30}>
            <PanelGroup orientation="horizontal">
              {explorerVisible && (
                <>
                  <Panel defaultSize={20} minSize={10} maxSize={40}>
                    <Explorer />
                  </Panel>
                  <PanelResizeHandle className="w-1 bg-[#313244] hover:bg-[#89b4fa] transition-colors" />
                </>
              )}

              <Panel minSize={20}>
                <EditorPanel />
              </Panel>

              {previewVisible && (
                <>
                  <PanelResizeHandle className="w-1 bg-[#313244] hover:bg-[#89b4fa] transition-colors" />
                  <Panel defaultSize={35} minSize={15}>
                    <PreviewPanel />
                  </Panel>
                </>
              )}
            </PanelGroup>
          </Panel>

          {diagnosticsVisible && (
            <>
              <PanelResizeHandle className="h-1 bg-[#313244] hover:bg-[#89b4fa] transition-colors" />
              <Panel defaultSize={25} minSize={10} maxSize={60}>
                <DiagnosticsPanel />
              </Panel>
            </>
          )}
        </PanelGroup>
      </div>

      <ProgressModal />
    </div>
  )
}
