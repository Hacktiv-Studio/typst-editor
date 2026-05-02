import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import type { ProjectEntry, CompileError } from '../types'

// ── Types de retour ──────────────────────────────────────────

export interface ProjectInfo {
  tmpPath: string
  tree: ProjectEntry[]
}

export interface CompileResult {
  pages: string[]          // SVG strings
  errors: CompileError[]
  output: string
  sourceMap: number[]      // index = page, value = min source line (0-based)
}

// ── Commandes projet ─────────────────────────────────────────

export const newProject = (name: string): Promise<ProjectInfo> =>
  invoke('new_project', { name })

export const openProject = (typzPath: string): Promise<ProjectInfo> =>
  invoke('open_project', { typzPath })

export const saveProject = (tmpPath: string, typzPath: string): Promise<void> =>
  invoke('save_project', { tmpPath, typzPath })

export const saveProjectAs = (tmpPath: string): Promise<string> =>
  invoke('save_project_as', { tmpPath })

export const cleanupTmp = (tmpPath: string): Promise<void> =>
  invoke('cleanup_tmp', { tmpPath })

// ── Compilation ──────────────────────────────────────────────

export const compilePreview = (tmpPath: string, entryFile: string): Promise<CompileResult> =>
  invoke('compile_preview', { tmpPath, entryFile })

export const exportProject = (
  tmpPath: string,
  entryFile: string,
  format: 'pdf' | 'png' | 'svg',
  outPath: string
): Promise<void> =>
  invoke('export_project', { tmpPath, entryFile, format, outPath })

// ── Filesystem ───────────────────────────────────────────────

export const createFile = (tmpPath: string, relPath: string): Promise<void> =>
  invoke('create_file', { tmpPath, relPath })

export const createFolder = (tmpPath: string, relPath: string): Promise<void> =>
  invoke('create_folder', { tmpPath, relPath })

export const renamePath = (tmpPath: string, oldRel: string, newRel: string): Promise<void> =>
  invoke('rename_path', { tmpPath, oldRel, newRel })

export const deletePath = (tmpPath: string, relPath: string): Promise<void> =>
  invoke('delete_path', { tmpPath, relPath })

export const readFile = (tmpPath: string, relPath: string): Promise<string> =>
  invoke('read_file', { tmpPath, relPath })

export const writeFile = (tmpPath: string, relPath: string, content: string): Promise<void> =>
  invoke('write_file', { tmpPath, relPath, content })

export const listProject = (tmpPath: string): Promise<ProjectEntry[]> =>
  invoke('list_project', { tmpPath })

// ── Events ───────────────────────────────────────────────────

// ProgressEvent is the raw event payload from the Rust backend.
// It does not include `visible` — that field belongs to UI state (ProgressState in types.ts).
export interface ProgressEvent {
  label: string
  current: number
  total: number
}

export const onProgress = (cb: (e: ProgressEvent) => void): Promise<() => void> =>
  listen<ProgressEvent>('progress', (e) => cb(e.payload))

export const importFile = (tmpPath: string, srcPath: string): Promise<string> =>
  invoke('import_file', { tmpPath, srcPath })

export const importFolder = (tmpPath: string, srcPath: string): Promise<string> =>
  invoke('import_folder', { tmpPath, srcPath })

export const importPath = (tmpPath: string, srcPath: string): Promise<string> =>
  invoke('import_path', { tmpPath, srcPath })

export const readPreviewCache = (tmpPath: string): Promise<string[] | null> =>
  invoke('read_preview_cache', { tmpPath }).catch(() => null) as Promise<string[] | null>

export const writePreviewCache = (tmpPath: string, pages: string[]): Promise<void> =>
  invoke('write_preview_cache', { tmpPath, pages }).catch(() => {}) as Promise<void>
