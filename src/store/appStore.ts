import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { AppState, ProgressState } from '../types'

const DEFAULT_PROGRESS: ProgressState = { visible: false, label: '', current: 0, total: 0 }

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      tmpPath: null,
      typzPath: null,
      isDirty: false,
      entryFile: 'main.typ',
      openFiles: [],
      activeFile: null,
      pages: [],
      sourceMap: [],
      activePage: 0,
      zoom: 1,
      showThumbnails: true,
      isCompiling: false,
      compileErrors: [],
      compileOutput: '',
      projectTree: [],
      explorerVisible: true,
      previewVisible: true,
      diagnosticsVisible: false,
      diagnosticsHeight: 180,
      progress: DEFAULT_PROGRESS,

      setProject: (tmpPath, typzPath, entryFile, tree) =>
        set({ tmpPath, typzPath, entryFile, projectTree: tree, openFiles: [], activeFile: null, pages: [], compileErrors: [] }),
      setTypzPath: (path) => set({ typzPath: path }),
      setDirty: (isDirty) => set({ isDirty }),
      openFile: (file) =>
        set((s) => ({
          openFiles: s.openFiles.find((f) => f.path === file.path)
            ? s.openFiles
            : [...s.openFiles, file],
          activeFile: file.path,
        })),
      closeFile: (path) =>
        set((s) => {
          const files = s.openFiles.filter((f) => f.path !== path)
          const active = s.activeFile === path ? (files[files.length - 1]?.path ?? null) : s.activeFile
          return { openFiles: files, activeFile: active }
        }),
      setActiveFile: (path) => set({ activeFile: path }),
      updateFileContent: (path, content) =>
        set((s) => ({
          openFiles: s.openFiles.map((f) => f.path === path ? { ...f, content, isDirty: true } : f),
          isDirty: true,
        })),
      markFileSaved: (path) =>
        set((s) => ({
          openFiles: s.openFiles.map((f) => f.path === path ? { ...f, isDirty: false } : f),
          isDirty: s.openFiles.some((f) => f.path !== path && f.isDirty),
        })),
      renameOpenFile: (oldPath, newPath) =>
        set((s) => ({
          openFiles: s.openFiles.map((f) => f.path === oldPath ? { ...f, path: newPath } : f),
          activeFile: s.activeFile === oldPath ? newPath : s.activeFile,
        })),
      setPages: (pages) => set({ pages }),
      setSourceMap: (sourceMap) => set({ sourceMap }),
      setActivePage: (activePage) => set({ activePage }),
      setZoom: (zoom) => set({ zoom }),
      toggleThumbnails: () => set((s) => ({ showThumbnails: !s.showThumbnails })),
      setCompiling: (isCompiling) => set({ isCompiling }),
      setCompileErrors: (compileErrors) => set({ compileErrors }),
      appendOutput: (line) => set((s) => ({ compileOutput: s.compileOutput + line + '\n' })),
      clearOutput: () => set({ compileOutput: '' }),
      setProjectTree: (projectTree) => set({ projectTree }),
      toggleExplorer: () => set((s) => ({ explorerVisible: !s.explorerVisible })),
      togglePreview: () => set((s) => ({ previewVisible: !s.previewVisible })),
      toggleDiagnostics: () => set((s) => ({ diagnosticsVisible: !s.diagnosticsVisible })),
      setDiagnosticsHeight: (diagnosticsHeight) => set({ diagnosticsHeight }),
      setProgress: (p) => set((s) => ({ progress: { ...s.progress, ...p } })),
    }),
    {
      name: 'typst-editor-ui',
      partialize: (s) => ({
        tmpPath: s.tmpPath,
        typzPath: s.typzPath,
        activeFile: s.activeFile,
        explorerVisible: s.explorerVisible,
        previewVisible: s.previewVisible,
        diagnosticsVisible: s.diagnosticsVisible,
        diagnosticsHeight: s.diagnosticsHeight,
        zoom: s.zoom,
        showThumbnails: s.showThumbnails,
      }),
    }
  )
)
