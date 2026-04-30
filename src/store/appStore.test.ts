import { describe, it, expect, beforeEach } from 'vitest'
import { useAppStore } from './appStore'

beforeEach(() => {
  useAppStore.setState({
    tmpPath: null, typzPath: null, isDirty: false, entryFile: 'main.typ',
    openFiles: [], activeFile: null, pages: [], activePage: 0,
    zoom: 1, showThumbnails: true, isCompiling: false,
    compileErrors: [], compileOutput: '', projectTree: [],
    explorerVisible: true, previewVisible: true,
    diagnosticsVisible: false, diagnosticsHeight: 180,
    progress: { visible: false, label: '', current: 0, total: 0 },
  })
})

describe('openFile', () => {
  it('adds file and sets it active', () => {
    useAppStore.getState().openFile({ path: 'main.typ', content: '= Hello', isDirty: false })
    const s = useAppStore.getState()
    expect(s.openFiles).toHaveLength(1)
    expect(s.activeFile).toBe('main.typ')
  })

  it('does not duplicate already-open file', () => {
    const file = { path: 'main.typ', content: '= Hello', isDirty: false }
    useAppStore.getState().openFile(file)
    useAppStore.getState().openFile(file)
    expect(useAppStore.getState().openFiles).toHaveLength(1)
  })
})

describe('closeFile', () => {
  it('removes file and sets last remaining file active', () => {
    useAppStore.getState().openFile({ path: 'a.typ', content: '', isDirty: false })
    useAppStore.getState().openFile({ path: 'b.typ', content: '', isDirty: false })
    useAppStore.getState().closeFile('b.typ')
    const s = useAppStore.getState()
    expect(s.openFiles).toHaveLength(1)
    expect(s.activeFile).toBe('a.typ')
  })
})

describe('updateFileContent', () => {
  it('marks file dirty', () => {
    useAppStore.getState().openFile({ path: 'main.typ', content: '', isDirty: false })
    useAppStore.getState().updateFileContent('main.typ', '= Updated')
    expect(useAppStore.getState().openFiles[0].isDirty).toBe(true)
    expect(useAppStore.getState().isDirty).toBe(true)
  })
})
