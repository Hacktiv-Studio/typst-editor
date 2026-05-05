import { Group as PanelGroup, Panel, Separator as PanelResizeHandle, useDefaultLayout } from 'react-resizable-panels'
import { useEffect } from 'react'
import { emit } from '@tauri-apps/api/event'
import { Sidebar } from './components/Sidebar'
import { Explorer } from './components/Explorer/Explorer'
import { EditorPanel } from './components/Editor/EditorPanel'
import { PreviewPanel } from './components/Preview/PreviewPanel'
import { DiagnosticsPanel } from './components/Diagnostics/DiagnosticsPanel'
import { ProgressModal } from './components/ProgressModal'
import { GlobalSearch } from './components/Search/GlobalSearch'
import { VersionsModal } from './components/History/VersionsModal'
import { useAppStore } from './store/appStore'
import { listProject, onProgress, readFile } from './tauri/commands'

export default function App() {
  const { explorerVisible, previewVisible, diagnosticsVisible, searchVisible, toggleSearch, versionsModalOpen, closeVersionsModal, setProgress, activePage } = useAppStore()

  const horizontalLayout = useDefaultLayout({
    id: 'h-panels',
    panelIds: explorerVisible && previewVisible
      ? ['explorer', 'editor', 'preview']
      : explorerVisible
        ? ['explorer', 'editor']
        : previewVisible
          ? ['editor', 'preview']
          : ['editor'],
  })

  const verticalLayout = useDefaultLayout({
    id: 'v-panels',
    panelIds: diagnosticsVisible ? ['main', 'diagnostics'] : ['main'],
  })

  useEffect(() => {
    emit('active-page-changed', activePage).catch(() => {})
  }, [activePage])

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
    const store = useAppStore.getState()
    const { tmpPath, activeFile } = store
    if (!tmpPath) return

    listProject(tmpPath)
      .then((tree) => {
        store.setProjectTree(tree)
        if (activeFile) {
          return readFile(tmpPath, activeFile).then((content) => {
            store.openFile({ path: activeFile, content, isDirty: false })
          })
        }
      })
      .catch(() => {
        // Project dir was deleted — reset state
        useAppStore.setState({ tmpPath: null, typzPath: null, activeFile: null, projectTree: [], openFiles: [] })
      })
  }, [])

  useEffect(() => {
    let unlisten: (() => void) | undefined
    import('@tauri-apps/api/event').then(({ listen }) => {
      listen<string>('open-typz', async (e) => {
        const { openProject, readFile } = await import('./tauri/commands')
        const info = await openProject(e.payload)
        const store = useAppStore.getState()
        store.setProject(info.tmpPath, e.payload, 'main.typ', info.tree)
        const content = await readFile(info.tmpPath, 'main.typ').catch(() => '')
        store.openFile({ path: 'main.typ', content, isDirty: false })
      }).then((fn) => { unlisten = fn })
    })
    return () => unlisten?.()
  }, [])

  return (
    <div className="app-root flex h-screen w-screen overflow-hidden bg-[#11111b] text-[#cdd6f4]">
      <Sidebar />

      <div className="flex flex-col flex-1 min-w-0">
        <PanelGroup
          orientation="vertical"
          className="flex-1"
          defaultLayout={verticalLayout.defaultLayout}
          onLayoutChanged={verticalLayout.onLayoutChanged}
        >
          <Panel id="main" defaultSize={75} minSize={20}>
            <PanelGroup
              orientation="horizontal"
              resizeTargetMinimumSize={{ coarse: 20, fine: 12 }}
              defaultLayout={horizontalLayout.defaultLayout}
              onLayoutChanged={horizontalLayout.onLayoutChanged}
            >
              {explorerVisible && (
                <Panel id="explorer" defaultSize={20} minSize="100px">
                  <Explorer />
                </Panel>
              )}
              {explorerVisible && (
                <PanelResizeHandle className="w-[5px] bg-[#313244] hover:bg-[#89b4fa] transition-colors" />
              )}

              <Panel id="editor" minSize="100px">
                <EditorPanel />
              </Panel>

              {previewVisible && (
                <PanelResizeHandle className="w-[5px] bg-[#313244] hover:bg-[#89b4fa] transition-colors" />
              )}
              {previewVisible && (
                <Panel id="preview" defaultSize={35} minSize="100px">
                  <PreviewPanel />
                </Panel>
              )}
            </PanelGroup>
          </Panel>

          {diagnosticsVisible && (
            <PanelResizeHandle className="h-[5px] bg-[#313244] hover:bg-[#89b4fa] transition-colors" />
          )}
          {diagnosticsVisible && (
            <Panel id="diagnostics" defaultSize={25} minSize={10}>
              <DiagnosticsPanel />
            </Panel>
          )}
        </PanelGroup>
      </div>

      <ProgressModal />
      {searchVisible && <GlobalSearch onClose={toggleSearch} />}
      {versionsModalOpen && <VersionsModal onClose={closeVersionsModal} />}
    </div>
  )
}
