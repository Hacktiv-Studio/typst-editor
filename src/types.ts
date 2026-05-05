export interface OpenFile {
  path: string
  content: string
  isDirty: boolean
}

export interface CompileError {
  file: string
  line: number
  col: number
  message: string
  severity: 'error' | 'warning'
}

export interface ProjectEntry {
  name: string
  path: string
  isDir: boolean
  children?: ProjectEntry[]
}

export interface ProgressState {
  visible: boolean
  label: string
  current: number
  total: number
}

export interface AppState {
  // Projet
  tmpPath: string | null
  typzPath: string | null
  isDirty: boolean
  entryFile: string

  // Éditeur
  openFiles: OpenFile[]
  activeFile: string | null

  // Aperçu
  pages: string[]
  sourceMap: Record<string, (number | null)[]>
  activePage: number
  zoom: number
  showThumbnails: boolean
  isCompiling: boolean
  compileErrors: CompileError[]
  compileOutput: string

  // Explorateur
  projectTree: ProjectEntry[]

  // UI
  language: 'fr' | 'en'
  explorerVisible: boolean
  previewVisible: boolean
  diagnosticsVisible: boolean
  searchVisible: boolean
  versionsModalOpen: boolean
  diagnosticsHeight: number
  progress: ProgressState
  recentProjects: string[]
  pendingJump: { file: string; byteOffset: number } | null

  // Actions
  setProject: (tmpPath: string, typzPath: string | null, entryFile: string, tree: ProjectEntry[]) => void
  setTypzPath: (path: string) => void
  setDirty: (dirty: boolean) => void
  openFile: (file: OpenFile) => void
  closeFile: (path: string) => void
  setActiveFile: (path: string) => void
  updateFileContent: (path: string, content: string) => void
  markFileSaved: (path: string) => void
  renameOpenFile: (oldPath: string, newPath: string) => void
  setPages: (pages: string[]) => void
  applyPagesDelta: (pageCount: number, updates: { index: number; svg: string }[]) => void
  setSourceMap: (map: Record<string, (number | null)[]>) => void
  setActivePage: (page: number) => void
  setZoom: (zoom: number) => void
  toggleThumbnails: () => void
  setCompiling: (compiling: boolean) => void
  setCompileErrors: (errors: CompileError[]) => void
  appendOutput: (line: string) => void
  clearOutput: () => void
  setProjectTree: (tree: ProjectEntry[]) => void
  setLanguage: (language: 'fr' | 'en') => void
  toggleExplorer: () => void
  togglePreview: () => void
  toggleDiagnostics: () => void
  toggleSearch: () => void
  openVersionsModal: () => void
  closeVersionsModal: () => void
  setDiagnosticsHeight: (h: number) => void
  setProgress: (p: Partial<ProgressState>) => void
  addRecentProject: (path: string) => void
  removeRecentProject: (path: string) => void
  setPendingJump: (jump: { file: string; byteOffset: number } | null) => void
}
