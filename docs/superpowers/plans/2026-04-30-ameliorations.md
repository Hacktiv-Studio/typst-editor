# Améliorations Typst Editor — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement 10 improvements to the Typst editor covering UI polish, Tailwind 4 migration, context menus, dialogs, syntax highlighting, and project persistence.

**Architecture:** Frontend is React + Zustand + CodeMirror 6 + react-resizable-panels v4 inside a Tauri 2 shell. Backend is Rust with Tauri commands. New shared UI components (Dialog, ContextMenu) are added to `src/components/ui/`. Tailwind 4 uses the `@tailwindcss/vite` plugin instead of PostCSS. Project session is restored on reload by persisting `tmpPath` and re-fetching the tree from disk.

**Tech Stack:** React 19, Zustand (persist middleware), CodeMirror 6, Tailwind CSS 4, Tauri 2, Rust/tokio, react-resizable-panels v4

---

## File Structure

**New files:**
- `src/components/ui/Dialog.tsx` — base modal overlay + panel, used by InputDialog and ConfirmDialog
- `src/components/ui/InputDialog.tsx` — modal with text input, replaces browser `prompt()`
- `src/components/ui/ConfirmDialog.tsx` — modal with Yes/Cancel, for delete confirmations
- `src/components/ui/ContextMenu.tsx` — floating context menu rendered in a portal
- `src/lib/typst-language.ts` — CodeMirror StreamLanguage definition for Typst syntax

**Modified files:**
- `package.json` — add `@tailwindcss/vite`, remove postcss tailwind deps
- `vite.config.ts` — add `@tailwindcss/vite` plugin
- `tailwind.config.js` — **deleted**
- `postcss.config.js` — **deleted**
- `src/index.css` — replace `@tailwind` directives with `@import "tailwindcss"`
- `src/App.tsx` — session restore on mount
- `src/store/appStore.ts` — persist `tmpPath`, `activeFile`, file paths for reload
- `src/types.ts` — add `AppState.restoreSession` action
- `src/components/Sidebar.tsx` — add Save/SaveAs + Explorer/Preview toggle buttons
- `src/components/Explorer/FileTree.tsx` — context menus, InputDialog for file/folder creation, import file/folder
- `src/components/Preview/PagesViewer.tsx` — empty state placeholder
- `src/components/Editor/CodeMirrorEditor.tsx` — add Typst syntax highlighting
- `src-tauri/src/commands/filesystem.rs` — add `import_file`, `import_folder` commands
- `src-tauri/src/lib.rs` — register new commands
- `src/tauri/commands.ts` — add `importFile`, `importFolder` TS wrappers

---

## Task 1: Migrate to Tailwind CSS 4

**Files:**
- Modify: `package.json`
- Modify: `vite.config.ts`
- Delete: `tailwind.config.js`
- Delete: `postcss.config.js`
- Modify: `src/index.css`

- [ ] **Step 1: Install Tailwind 4 packages**

```bash
cd /home/romain/Projets/typst-editor
npm uninstall tailwindcss autoprefixer
npm install tailwindcss@4 @tailwindcss/vite
```

Expected: no errors, `tailwindcss@4.x.x` and `@tailwindcss/vite@4.x.x` in node_modules.

- [ ] **Step 2: Update `vite.config.ts` to use the Tailwind Vite plugin**

Replace the entire file with:

```typescript
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// @ts-expect-error process is a nodejs global
const host = process.env.TAURI_DEV_HOST;

export default defineConfig(async () => ({
  plugins: [react(), tailwindcss()],

  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? { protocol: "ws", host, port: 1421 }
      : undefined,
    watch: {
      ignored: ["**/src-tauri/**"],
    },
  },

  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setup.ts',
  },
}));
```

- [ ] **Step 3: Replace CSS entry point**

Replace `src/index.css` entirely with:

```css
@import "tailwindcss";
```

- [ ] **Step 4: Delete the now-unused config files**

```bash
rm /home/romain/Projets/typst-editor/tailwind.config.js
rm /home/romain/Projets/typst-editor/postcss.config.js
```

- [ ] **Step 5: Verify the app compiles and all classes still work**

```bash
cd /home/romain/Projets/typst-editor
npx tsc --noEmit
```

Expected: no TypeScript errors.

Start the dev server and visually verify the Catppuccin Mocha theme is intact (dark background, blue accents, correct font sizes).

- [ ] **Step 6: Commit**

```bash
git add vite.config.ts src/index.css package.json package-lock.json
git rm tailwind.config.js postcss.config.js
git commit -m "chore: migrate to Tailwind CSS 4 with @tailwindcss/vite"
```

---

## Task 2: Panel minimum width (100 px) + Explorer/Preview toggle buttons

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/components/Sidebar.tsx`

The sidebar already has `toggleExplorer` and `togglePreview` actions in the store but no buttons for them. `explorerVisible` and `previewVisible` are already persisted.

- [ ] **Step 1: Set panel minSize to 100 px in `src/App.tsx`**

In `src/App.tsx`, change every horizontal Panel's `minSize` from a percentage to `"100px"`:

```tsx
{explorerVisible && (
  <Panel id="explorer" defaultSize={20} minSize="100px">
    <Explorer />
  </Panel>
)}
{/* ... separators unchanged ... */}
<Panel id="editor" minSize="100px">
  <EditorPanel />
</Panel>
{previewVisible && (
  <Panel id="preview" defaultSize={35} minSize="100px">
    <PreviewPanel />
  </Panel>
)}
```

The vertical Diagnostics panel can stay with `minSize={10}` (percentage is fine for vertical).

- [ ] **Step 2: Add Explorer and Preview toggle buttons to `src/components/Sidebar.tsx`**

Import `FaSidebar` and `FaEye` from `react-icons/fa6`. Add `toggleExplorer`, `togglePreview`, and `explorerVisible`, `previewVisible` from the store. Insert two buttons in the "Bottom actions" section, above the diagnostics button:

```tsx
import {
  FaFolderPlus, FaFolderOpen, FaFileExport, FaFilePdf,
  FaFileImage, FaVectorSquare, FaTerminal, FaSidebar, FaEye,
} from 'react-icons/fa6'

// In component:
const {
  tmpPath, entryFile,
  toggleDiagnostics, setProject, diagnosticsVisible, openFile,
  toggleExplorer, explorerVisible,
  togglePreview, previewVisible,
} = useAppStore()

// In JSX, inside "Bottom actions" div, before the diagnostics button:
<button
  title="Explorateur"
  onClick={toggleExplorer}
  className={`w-8 h-8 flex items-center justify-center rounded-md transition-colors ${
    explorerVisible
      ? 'bg-[#89b4fa] text-[#11111b] hover:bg-[#74c7ec]'
      : 'text-[#585b70] hover:text-[#cdd6f4] hover:bg-[#313244]'
  }`}
>
  <FaSidebar size={13} />
</button>
<button
  title="Aperçu"
  onClick={togglePreview}
  className={`w-8 h-8 flex items-center justify-center rounded-md transition-colors ${
    previewVisible
      ? 'bg-[#89b4fa] text-[#11111b] hover:bg-[#74c7ec]'
      : 'text-[#585b70] hover:text-[#cdd6f4] hover:bg-[#313244]'
  }`}
>
  <FaEye size={13} />
</button>
```

- [ ] **Step 3: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/App.tsx src/components/Sidebar.tsx
git commit -m "feat: panel min width 100px and Explorer/Preview toggle buttons"
```

---

## Task 3: Preview empty state

**Files:**
- Modify: `src/components/Preview/PagesViewer.tsx`

Currently when no project is open the preview area is blank. Show a placeholder.

- [ ] **Step 1: Read the current PagesViewer**

```bash
cat src/components/Preview/PagesViewer.tsx
```

- [ ] **Step 2: Add empty state**

In `PagesViewer.tsx`, import `useAppStore` and `tmpPath`. Add a placeholder before the pages rendering:

```tsx
import { useAppStore } from '../../store/appStore'

export function PagesViewer() {
  const { pages, zoom, activePage, setActivePage, tmpPath } = useAppStore()

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
      <div className="flex-1 flex items-center justify-center text-[#585b70] text-sm">
        Page blanche — écrivez du contenu pour voir l'aperçu
      </div>
    )
  }

  // ... existing rendering code unchanged
}
```

- [ ] **Step 3: Type-check and commit**

```bash
npx tsc --noEmit
git add src/components/Preview/PagesViewer.tsx
git commit -m "feat: preview empty state when no project or no pages"
```

---

## Task 4: Restore project session on page reload

**Files:**
- Modify: `src/store/appStore.ts`
- Modify: `src/types.ts`
- Modify: `src/App.tsx`

Currently `tmpPath` is not persisted — reloading loses the open project. The app data directory is permanent, so we just need to re-read the tree and last-open file from disk on startup.

- [ ] **Step 1: Add `tmpPath` and `activeFile` to the persisted slice in `src/store/appStore.ts`**

In the `partialize` function, add `tmpPath` and `activeFile`:

```typescript
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
```

- [ ] **Step 2: Add session restore logic in `src/App.tsx`**

Add a `useEffect` that runs once on mount. If `tmpPath` is in the restored store, re-fetch the file tree and reopen the last active file:

```tsx
import { listProject, readFile } from './tauri/commands'

// Inside App(), after existing useEffects:
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
      // Project dir was deleted (e.g. /tmp cleanup) — reset state
      store.setProject(null, null, 'main.typ', [])
    })
}, [])
```

- [ ] **Step 3: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/store/appStore.ts src/App.tsx
git commit -m "feat: restore project session on page reload"
```

---

## Task 5: Save / Save As buttons

**Files:**
- Modify: `src/components/Sidebar.tsx`

The `saveProject` Tauri command already exists. The EditorPanel's Ctrl+S already saves the current file and calls `saveProject` if `typzPath` is set. We need explicit Save and Save As buttons in the sidebar.

- [ ] **Step 1: Add `FaFloppyDisk` import and `saveProject` / `saveProjectAs` imports in `src/components/Sidebar.tsx`**

```tsx
import { FaFloppyDisk, FaFolderPlus, FaFolderOpen, FaFileExport, FaFilePdf,
         FaFileImage, FaVectorSquare, FaTerminal, FaSidebar, FaEye } from 'react-icons/fa6'
import { newProject, openProject, exportProject, readFile, saveProject } from '../tauri/commands'
import { open, save } from '@tauri-apps/plugin-dialog'
```

Add `typzPath`, `setTypzPath`, `openFiles`, `activeFile`, `markFileSaved`, `writeFile` from the store.

- [ ] **Step 2: Add `handleSave` and `handleSaveAs` in `src/components/Sidebar.tsx`**

```tsx
const { tmpPath, typzPath, entryFile, setTypzPath, openFiles, activeFile, markFileSaved,
        toggleDiagnostics, setProject, diagnosticsVisible, openFile,
        toggleExplorer, explorerVisible, togglePreview, previewVisible } = useAppStore()

async function handleSave() {
  if (!tmpPath) return
  if (typzPath) {
    // Save current file first
    const file = openFiles.find((f) => f.path === activeFile)
    if (file) {
      await writeFile(tmpPath, file.path, file.content)
      markFileSaved(file.path)
    }
    await saveProject(tmpPath, typzPath)
  } else {
    await handleSaveAs()
  }
}

async function handleSaveAs() {
  if (!tmpPath) return
  const outPath = await save({
    filters: [{ name: 'Typst Project', extensions: ['typz'] }],
  })
  if (!outPath) return
  setTypzPath(outPath as string)
  await saveProject(tmpPath, outPath as string)
}
```

Import `writeFile` from `'../tauri/commands'`.

- [ ] **Step 3: Add Save button in the "Actions" section of the sidebar JSX**

Below the "Ouvrir un projet" button, add:

```tsx
<button
  title="Enregistrer (Ctrl+S)"
  onClick={handleSave}
  disabled={!tmpPath}
  className="w-8 h-8 flex items-center justify-center text-[#585b70] hover:text-[#cdd6f4] hover:bg-[#313244] rounded-md transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-[#585b70]"
>
  <FaFloppyDisk size={14} />
</button>
```

- [ ] **Step 4: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/components/Sidebar.tsx
git commit -m "feat: Save and Save As buttons in sidebar"
```

---

## Task 6: Shared Dialog UI components

**Files:**
- Create: `src/components/ui/Dialog.tsx`
- Create: `src/components/ui/InputDialog.tsx`
- Create: `src/components/ui/ConfirmDialog.tsx`

These replace browser `prompt()` and `confirm()` with styled React modals rendered via a portal into `document.body`.

- [ ] **Step 1: Create `src/components/ui/Dialog.tsx`**

```tsx
import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'

interface DialogProps {
  title: string
  children: React.ReactNode
  actions: React.ReactNode
  onClose: () => void
}

export function Dialog({ title, children, actions, onClose }: DialogProps) {
  const overlayRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [onClose])

  return createPortal(
    <div
      ref={overlayRef}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60"
      onMouseDown={(e) => { if (e.target === overlayRef.current) onClose() }}
    >
      <div className="bg-[#1e1e2e] border border-[#45475a] rounded-xl shadow-2xl w-80 overflow-hidden">
        <div className="px-4 py-3 border-b border-[#313244] text-[#cdd6f4] text-sm font-semibold">
          {title}
        </div>
        <div className="px-4 py-3">{children}</div>
        <div className="px-4 py-3 border-t border-[#313244] flex justify-end gap-2">
          {actions}
        </div>
      </div>
    </div>,
    document.body
  )
}
```

- [ ] **Step 2: Create `src/components/ui/InputDialog.tsx`**

```tsx
import { useEffect, useRef, useState } from 'react'
import { Dialog } from './Dialog'

interface InputDialogProps {
  title: string
  label: string
  defaultValue?: string
  onConfirm: (value: string) => void
  onClose: () => void
}

export function InputDialog({ title, label, defaultValue = '', onConfirm, onClose }: InputDialogProps) {
  const [value, setValue] = useState(defaultValue)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
    inputRef.current?.select()
  }, [])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = value.trim()
    if (trimmed) onConfirm(trimmed)
  }

  return (
    <Dialog
      title={title}
      onClose={onClose}
      actions={
        <>
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-xs text-[#a6adc8] hover:text-[#cdd6f4] rounded-md hover:bg-[#313244] transition-colors"
          >
            Annuler
          </button>
          <button
            onClick={handleSubmit}
            disabled={!value.trim()}
            className="px-3 py-1.5 text-xs bg-[#89b4fa] text-[#11111b] rounded-md hover:bg-[#74c7ec] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Confirmer
          </button>
        </>
      }
    >
      <form onSubmit={handleSubmit}>
        <label className="block text-xs text-[#a6adc8] mb-1.5">{label}</label>
        <input
          ref={inputRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="w-full bg-[#313244] border border-[#45475a] rounded-md px-3 py-1.5 text-sm text-[#cdd6f4] outline-none focus:border-[#89b4fa] transition-colors"
        />
      </form>
    </Dialog>
  )
}
```

- [ ] **Step 3: Create `src/components/ui/ConfirmDialog.tsx`**

```tsx
import { Dialog } from './Dialog'

interface ConfirmDialogProps {
  title: string
  message: string
  confirmLabel?: string
  onConfirm: () => void
  onClose: () => void
}

export function ConfirmDialog({
  title,
  message,
  confirmLabel = 'Supprimer',
  onConfirm,
  onClose,
}: ConfirmDialogProps) {
  return (
    <Dialog
      title={title}
      onClose={onClose}
      actions={
        <>
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-xs text-[#a6adc8] hover:text-[#cdd6f4] rounded-md hover:bg-[#313244] transition-colors"
          >
            Annuler
          </button>
          <button
            onClick={() => { onConfirm(); onClose() }}
            className="px-3 py-1.5 text-xs bg-[#f38ba8] text-[#11111b] rounded-md hover:bg-[#e06c75] transition-colors"
          >
            {confirmLabel}
          </button>
        </>
      }
    >
      <p className="text-sm text-[#a6adc8]">{message}</p>
    </Dialog>
  )
}
```

- [ ] **Step 4: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/components/ui/
git commit -m "feat: shared Dialog, InputDialog, ConfirmDialog components"
```

---

## Task 7: Context menus in Explorer + import file/folder (Rust + TS + UI)

**Files:**
- Create: `src/components/ui/ContextMenu.tsx`
- Modify: `src/components/Explorer/FileTree.tsx`
- Modify: `src-tauri/src/commands/filesystem.rs`
- Modify: `src-tauri/src/lib.rs`
- Modify: `src/tauri/commands.ts`

Context menus appear on right-click. Two variants:
- **Background** (no entry selected): New File, New Folder, separator, Import File, Import Folder
- **Entry** (file or folder selected): Rename, separator, Delete

"Import" copies a file or folder from anywhere on disk into the project directory.

- [ ] **Step 1: Add `import_file` and `import_folder` Rust commands in `src-tauri/src/commands/filesystem.rs`**

Add at the end of the file, before the `#[cfg(test)]` block:

```rust
#[command]
pub async fn import_file(tmp_path: String, src_path: String) -> Result<String, String> {
    let root = PathBuf::from(&tmp_path);
    let src = PathBuf::from(&src_path);
    let name = src.file_name()
        .ok_or_else(|| "invalid source path".to_string())?
        .to_string_lossy()
        .to_string();
    let dest = safe_join(&root, &name)?;
    tokio::fs::copy(&src, &dest).await.map_err(|e| e.to_string())?;
    Ok(name)
}

#[command]
pub async fn import_folder(tmp_path: String, src_path: String) -> Result<String, String> {
    let root = PathBuf::from(&tmp_path);
    let src = PathBuf::from(&src_path);
    let name = src.file_name()
        .ok_or_else(|| "invalid source path".to_string())?
        .to_string_lossy()
        .to_string();
    let dest = safe_join(&root, &name)?;
    copy_dir_recursive(&src, &dest).await
        .map_err(|e| e.to_string())?;
    Ok(name)
}

async fn copy_dir_recursive(src: &PathBuf, dest: &PathBuf) -> std::io::Result<()> {
    tokio::fs::create_dir_all(dest).await?;
    let mut entries = tokio::fs::read_dir(src).await?;
    while let Some(entry) = entries.next_entry().await? {
        let src_path = entry.path();
        let dest_path = dest.join(entry.file_name());
        if src_path.is_dir() {
            Box::pin(copy_dir_recursive(&src_path, &dest_path)).await?;
        } else {
            tokio::fs::copy(&src_path, &dest_path).await?;
        }
    }
    Ok(())
}
```

- [ ] **Step 2: Register commands in `src-tauri/src/lib.rs`**

Add `import_file` and `import_folder` to the `.invoke_handler` call:

```rust
.invoke_handler(tauri::generate_handler![
    // ... existing commands ...
    commands::filesystem::import_file,
    commands::filesystem::import_folder,
])
```

Also add `pub use commands::filesystem::{import_file, import_folder};` in the commands module if needed — check `src-tauri/src/commands/mod.rs` for the pattern used.

- [ ] **Step 3: Add TS wrappers in `src/tauri/commands.ts`**

```typescript
export const importFile = (tmpPath: string, srcPath: string): Promise<string> =>
  invoke('import_file', { tmpPath, srcPath })

export const importFolder = (tmpPath: string, srcPath: string): Promise<string> =>
  invoke('import_folder', { tmpPath, srcPath })
```

- [ ] **Step 4: Create `src/components/ui/ContextMenu.tsx`**

```tsx
import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'

export interface ContextMenuItem {
  label: string
  onClick: () => void
  danger?: boolean
}

export type ContextMenuEntry = ContextMenuItem | 'separator'

interface ContextMenuProps {
  x: number
  y: number
  items: ContextMenuEntry[]
  onClose: () => void
}

export function ContextMenu({ x, y, items, onClose }: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleDown(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('mousedown', handleDown)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('mousedown', handleDown)
      document.removeEventListener('keydown', handleKey)
    }
  }, [onClose])

  // Keep menu within viewport
  const style: React.CSSProperties = {
    position: 'fixed',
    top: Math.min(y, window.innerHeight - 200),
    left: Math.min(x, window.innerWidth - 180),
    zIndex: 200,
  }

  return createPortal(
    <div
      ref={menuRef}
      style={style}
      className="bg-[#313244] border border-[#45475a] rounded-lg w-44 shadow-xl overflow-hidden py-1"
    >
      {items.map((item, i) =>
        item === 'separator' ? (
          <div key={i} className="h-px bg-[#45475a] my-1" />
        ) : (
          <button
            key={i}
            onClick={() => { item.onClick(); onClose() }}
            className={`w-full px-3 py-1.5 text-left text-[11px] transition-colors hover:bg-[#45475a] ${
              item.danger ? 'text-[#f38ba8]' : 'text-[#cdd6f4]'
            }`}
          >
            {item.label}
          </button>
        )
      )}
    </div>,
    document.body
  )
}
```

- [ ] **Step 5: Rewrite `src/components/Explorer/FileTree.tsx`**

Replace the entire file with this version that uses context menus, InputDialog, ConfirmDialog, and no more `prompt()`:

```tsx
import { useState, useCallback } from 'react'
import {
  FaChevronRight, FaChevronDown,
  FaFolder, FaFolderOpen, FaFileLines,
} from 'react-icons/fa6'
import { useAppStore } from '../../store/appStore'
import {
  readFile, createFile, createFolder, listProject,
  renamePath, deletePath, importFile, importFolder,
} from '../../tauri/commands'
import { open as openDialog } from '@tauri-apps/plugin-dialog'
import type { ProjectEntry } from '../../types'
import { InputDialog } from '../ui/InputDialog'
import { ConfirmDialog } from '../ui/ConfirmDialog'
import { ContextMenu, type ContextMenuEntry } from '../ui/ContextMenu'

type DialogState =
  | { type: 'none' }
  | { type: 'newFile'; parentDir: string }
  | { type: 'newFolder'; parentDir: string }
  | { type: 'rename'; entry: ProjectEntry }
  | { type: 'delete'; entry: ProjectEntry }

type MenuState =
  | { type: 'none' }
  | { type: 'background'; x: number; y: number; parentDir: string }
  | { type: 'entry'; x: number; y: number; entry: ProjectEntry }

function TreeNode({
  entry,
  depth = 0,
  onContextMenu,
}: {
  entry: ProjectEntry
  depth?: number
  onContextMenu: (e: React.MouseEvent, entry: ProjectEntry) => void
}) {
  const [open, setOpen] = useState(depth === 0)
  const { tmpPath, openFile, activeFile } = useAppStore()

  async function handleFileClick() {
    if (!tmpPath) return
    const content = await readFile(tmpPath, entry.path)
    openFile({ path: entry.path, content, isDirty: false })
  }

  const isActive = !entry.isDir && entry.path === activeFile

  return (
    <div>
      <div
        className={`flex items-center gap-1.5 py-0.5 cursor-pointer text-[#a6adc8] text-[10px] group select-none ${
          isActive ? 'bg-[#313244]' : 'hover:bg-[#313244]/50'
        }`}
        style={{ paddingLeft: `${16 + depth * 12}px` }}
        onClick={() => (entry.isDir ? setOpen((o) => !o) : handleFileClick())}
        onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); onContextMenu(e, entry) }}
      >
        {entry.isDir ? (
          open
            ? <FaChevronDown size={8} className="text-[#585b70]" />
            : <FaChevronRight size={8} className="text-[#585b70]" />
        ) : (
          <span className="w-2" />
        )}
        {entry.isDir
          ? (open
              ? <FaFolderOpen size={11} className="text-[#f9e2af]" />
              : <FaFolder size={11} className="text-[#f9e2af]" />)
          : <FaFileLines size={11} className="text-[#89b4fa]" />
        }
        <span className="truncate flex-1">{entry.name}</span>
      </div>
      {entry.isDir && open && entry.children?.map((child) => (
        <TreeNode key={child.path} entry={child} depth={depth + 1} onContextMenu={onContextMenu} />
      ))}
    </div>
  )
}

export function FileTree() {
  const { projectTree, tmpPath, setProjectTree } = useAppStore()
  const [dialog, setDialog] = useState<DialogState>({ type: 'none' })
  const [menu, setMenu] = useState<MenuState>({ type: 'none' })

  const refreshTree = useCallback(async () => {
    if (!tmpPath) return
    const tree = await listProject(tmpPath)
    setProjectTree(tree)
  }, [tmpPath, setProjectTree])

  // --- Context menu on entry ---
  function openEntryMenu(e: React.MouseEvent, entry: ProjectEntry) {
    setMenu({ type: 'entry', x: e.clientX, y: e.clientY, entry })
  }

  // --- Context menu on background ---
  function openBackgroundMenu(e: React.MouseEvent) {
    e.preventDefault()
    setMenu({ type: 'background', x: e.clientX, y: e.clientY, parentDir: '' })
  }

  // --- Actions ---
  async function handleCreateFile(parentDir: string, name: string) {
    if (!tmpPath) return
    const rel = parentDir ? `${parentDir}/${name}` : name
    await createFile(tmpPath, rel)
    await refreshTree()
  }

  async function handleCreateFolder(parentDir: string, name: string) {
    if (!tmpPath) return
    const rel = parentDir ? `${parentDir}/${name}` : name
    await createFolder(tmpPath, rel)
    await refreshTree()
  }

  async function handleRename(entry: ProjectEntry, newName: string) {
    if (!tmpPath) return
    const parent = entry.path.includes('/')
      ? entry.path.substring(0, entry.path.lastIndexOf('/'))
      : ''
    const newRel = parent ? `${parent}/${newName}` : newName
    await renamePath(tmpPath, entry.path, newRel)
    await refreshTree()
  }

  async function handleDelete(entry: ProjectEntry) {
    if (!tmpPath) return
    await deletePath(tmpPath, entry.path)
    await refreshTree()
  }

  async function handleImportFile(parentDir: string) {
    if (!tmpPath) return
    const selected = await openDialog({ multiple: false })
    if (!selected) return
    await importFile(tmpPath, selected as string)
    await refreshTree()
  }

  async function handleImportFolder(parentDir: string) {
    if (!tmpPath) return
    const selected = await openDialog({ directory: true })
    if (!selected) return
    await importFolder(tmpPath, selected as string)
    await refreshTree()
  }

  // --- Menu item builders ---
  function backgroundMenuItems(parentDir: string): ContextMenuEntry[] {
    return [
      { label: 'Nouveau fichier', onClick: () => setDialog({ type: 'newFile', parentDir }) },
      { label: 'Nouveau dossier', onClick: () => setDialog({ type: 'newFolder', parentDir }) },
      'separator',
      { label: 'Importer un fichier', onClick: () => handleImportFile(parentDir) },
      { label: 'Importer un dossier', onClick: () => handleImportFolder(parentDir) },
    ]
  }

  function entryMenuItems(entry: ProjectEntry): ContextMenuEntry[] {
    return [
      { label: 'Renommer', onClick: () => setDialog({ type: 'rename', entry }) },
      'separator',
      { label: 'Supprimer', onClick: () => setDialog({ type: 'delete', entry }), danger: true },
    ]
  }

  return (
    <div
      className="flex-1 overflow-auto"
      onContextMenu={openBackgroundMenu}
    >
      <div className="px-2 py-1.5 text-[9px] font-bold uppercase tracking-wider text-[#585b70]">
        Projet
      </div>

      {projectTree.map((entry) => (
        <TreeNode key={entry.path} entry={entry} onContextMenu={openEntryMenu} />
      ))}

      {/* Invisible fill area to catch right-clicks on empty space */}
      <div className="min-h-[60px]" />

      {/* Context menus */}
      {menu.type === 'background' && (
        <ContextMenu
          x={menu.x} y={menu.y}
          items={backgroundMenuItems(menu.parentDir)}
          onClose={() => setMenu({ type: 'none' })}
        />
      )}
      {menu.type === 'entry' && (
        <ContextMenu
          x={menu.x} y={menu.y}
          items={entryMenuItems(menu.entry)}
          onClose={() => setMenu({ type: 'none' })}
        />
      )}

      {/* Dialogs */}
      {dialog.type === 'newFile' && (
        <InputDialog
          title="Nouveau fichier"
          label="Nom du fichier"
          onConfirm={(name) => handleCreateFile(dialog.parentDir, name)}
          onClose={() => setDialog({ type: 'none' })}
        />
      )}
      {dialog.type === 'newFolder' && (
        <InputDialog
          title="Nouveau dossier"
          label="Nom du dossier"
          onConfirm={(name) => handleCreateFolder(dialog.parentDir, name)}
          onClose={() => setDialog({ type: 'none' })}
        />
      )}
      {dialog.type === 'rename' && (
        <InputDialog
          title="Renommer"
          label="Nouveau nom"
          defaultValue={dialog.entry.name}
          onConfirm={(name) => handleRename(dialog.entry, name)}
          onClose={() => setDialog({ type: 'none' })}
        />
      )}
      {dialog.type === 'delete' && (
        <ConfirmDialog
          title="Supprimer"
          message={`Supprimer "${dialog.entry.name}" ? Cette action est irréversible.`}
          onConfirm={() => handleDelete(dialog.entry)}
          onClose={() => setDialog({ type: 'none' })}
        />
      )}
    </div>
  )
}
```

Also remove the old `FaFileCirclePlus`, `FaFolderPlus` buttons from the header — the context menu replaces them.

- [ ] **Step 6: Verify Rust compiles**

```bash
cd src-tauri && cargo test 2>&1 | tail -10
```

Expected: all tests pass.

- [ ] **Step 7: Type-check frontend**

```bash
cd .. && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add src-tauri/src/commands/filesystem.rs src-tauri/src/lib.rs \
        src/tauri/commands.ts \
        src/components/ui/ContextMenu.tsx \
        src/components/Explorer/FileTree.tsx
git commit -m "feat: context menus in explorer, import file/folder, InputDialog/ConfirmDialog for file ops"
```

---

## Task 8: Typst syntax highlighting in CodeMirror

**Files:**
- Create: `src/lib/typst-language.ts`
- Modify: `src/components/Editor/CodeMirrorEditor.tsx`

Uses `StreamLanguage` from `@codemirror/language` — no extra npm package needed (already installed). Highlights: headings, bold, italic, raw/code, comments, math, hash-commands (`#set`, `#let`, `#import`, `#func(...)`), strings.

- [ ] **Step 1: Create `src/lib/typst-language.ts`**

```typescript
import { StreamLanguage, type StringStream } from '@codemirror/language'

interface State {
  inMathBlock: boolean
  inRawBlock: boolean
}

const typstLanguage = StreamLanguage.define<State>({
  name: 'typst',

  startState(): State {
    return { inMathBlock: false, inRawBlock: false }
  },

  token(stream: StringStream, state: State): string | null {
    // Raw block fence ``` ... ```
    if (stream.match('```')) {
      state.inRawBlock = !state.inRawBlock
      return 'monospace'
    }
    if (state.inRawBlock) {
      stream.skipToEnd()
      return 'monospace'
    }

    // Math block $$ ... $$
    if (stream.match('$$')) {
      state.inMathBlock = !state.inMathBlock
      return 'string'
    }
    if (state.inMathBlock) {
      stream.skipToEnd()
      return 'string'
    }

    // Line comment //
    if (stream.match('//')) {
      stream.skipToEnd()
      return 'comment'
    }

    // Block comment /* ... */
    if (stream.match('/*')) {
      while (!stream.eol()) {
        if (stream.match('*/')) break
        stream.next()
      }
      return 'comment'
    }

    // Inline raw `...`
    if (stream.match('`')) {
      while (!stream.eol() && !stream.match('`', true)) stream.next()
      return 'monospace'
    }

    // Inline math $ ... $
    if (stream.match('$')) {
      while (!stream.eol() && !stream.match('$', true)) stream.next()
      return 'string'
    }

    // Headings = / == / ===
    if (stream.sol() && stream.match(/^=+\s/)) {
      stream.skipToEnd()
      return 'heading'
    }

    // Bold *...*
    if (stream.match('*')) {
      while (!stream.eol() && !stream.match('*', true)) stream.next()
      return 'strong'
    }

    // Italic _..._
    if (stream.match('_')) {
      while (!stream.eol() && !stream.match('_', true)) stream.next()
      return 'emphasis'
    }

    // Hash commands: #keyword or #funcname(
    if (stream.match('#')) {
      stream.match(/^[a-zA-Z_][a-zA-Z0-9_-]*/)
      return 'keyword'
    }

    // String literals "..."
    if (stream.match('"')) {
      while (!stream.eol()) {
        if (stream.next() === '"') break
      }
      return 'string'
    }

    stream.next()
    return null
  },
})

export { typstLanguage }
```

- [ ] **Step 2: Add Typst language to `src/components/Editor/CodeMirrorEditor.tsx`**

Import and add to the extensions array:

```tsx
import { StreamLanguage } from '@codemirror/language'
import { typstLanguage } from '../../lib/typst-language'

// In the extensions array, add after `syntaxHighlighting(...)`:
typstLanguage,
```

Full updated extensions array:

```tsx
const extensions = [
  history(),
  keymap.of([
    ...defaultKeymap,
    ...historyKeymap,
    { key: 'Mod-s', run: () => { onSaveRef.current(); return true } },
  ]),
  oneDark,
  syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
  typstLanguage,
  EditorView.updateListener.of((update) => {
    if (update.docChanged) {
      onChangeRef.current(update.state.doc.toString())
    }
  }),
  EditorView.theme({
    '&': { height: '100%', fontSize: '12px' },
    '.cm-scroller': { overflow: 'auto', fontFamily: "'JetBrains Mono', 'Fira Code', monospace" },
  }),
]
```

- [ ] **Step 3: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors. If `StringStream` import causes issues, import it as `import { StreamLanguage } from '@codemirror/language'` and type the stream parameter as `any`.

- [ ] **Step 4: Commit**

```bash
git add src/lib/typst-language.ts src/components/Editor/CodeMirrorEditor.tsx
git commit -m "feat: Typst syntax highlighting in CodeMirror editor"
```

---

## Self-Review

**Spec coverage check:**

| Requirement | Task |
|---|---|
| Bouton Enregistrer / Enregistrer sous | Task 5 ✅ |
| Tailwind 4 | Task 1 ✅ |
| Page blanche quand projet vide | Task 3 ✅ |
| Menus contextuels explorateur (background) | Task 7 ✅ |
| Menus contextuels explorateur (entry) | Task 7 ✅ |
| Confirm dialog React pour suppression | Task 6 + 7 ✅ |
| Color highlight éditeur | Task 8 ✅ |
| Dialogbox création fichier/dossier | Task 6 + 7 ✅ |
| Recharger sans perdre le projet | Task 4 ✅ |
| Afficher/masquer chaque panel | Task 2 ✅ |
| Largeur minimale 100px panels horizontaux | Task 2 ✅ |

**Placeholder scan:** None found — all steps have concrete code.

**Type consistency:** `ContextMenuEntry`, `DialogState`, `MenuState` defined in Task 7 and used only within FileTree.tsx. `Dialog`/`InputDialog`/`ConfirmDialog` props defined in Task 6 and referenced correctly in Task 7.

---

Plan complete and saved to `docs/superpowers/plans/2026-04-30-ameliorations.md`. Two execution options:

**1. Subagent-Driven (recommended)** — Je dispatch un sous-agent par tâche, review entre chaque, itération rapide.

**2. Inline Execution** — J'exécute les tâches dans cette session avec des checkpoints.

**Quelle approche ?**
