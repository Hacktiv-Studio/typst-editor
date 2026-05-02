export interface OpenFile {
  path: string       // chemin relatif depuis la racine du projet
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
  path: string       // chemin relatif
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
  pages: string[]           // SVG raw strings
  activePage: number
  zoom: number
  showThumbnails: boolean
  isCompiling: boolean
  compileErrors: CompileError[]
  compileOutput: string

  // Explorateur
  projectTree: ProjectEntry[]

  // UI
  explorerVisible: boolean
  previewVisible: boolean
  diagnosticsVisible: boolean
  diagnosticsHeight: number
  progress: ProgressState

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
  setActivePage: (page: number) => void
  setZoom: (zoom: number) => void
  toggleThumbnails: () => void
  setCompiling: (compiling: boolean) => void
  setCompileErrors: (errors: CompileError[]) => void
  appendOutput: (line: string) => void
  clearOutput: () => void
  setProjectTree: (tree: ProjectEntry[]) => void
  toggleExplorer: () => void
  togglePreview: () => void
  toggleDiagnostics: () => void
  setDiagnosticsHeight: (h: number) => void
  setProgress: (p: Partial<ProgressState>) => void
}
