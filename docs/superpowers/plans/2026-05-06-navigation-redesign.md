# Navigation Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reorganiser la sidebar en 3 groupes sémantiques (Projet / Vues / Outils), convertir Save en dropdown Save+SaveAs, et ajouter un SettingsModal pour la langue.

**Architecture:** La sidebar conserve sa structure existante (44px, Catppuccin Mocha) mais les icônes sont réordonnées. Le SettingsModal suit exactement le pattern de VersionsModal. La langue bascule dans le modal plutôt que dans la sidebar.

**Tech Stack:** React 18, TypeScript, Zustand, Tailwind CSS, react-icons/fa6, Vitest + React Testing Library

---

### Task 1 : Étendre le store — settingsModalOpen

**Files:**
- Modify: `src/types.ts`
- Modify: `src/store/appStore.ts`
- Test: `src/components/Settings/SettingsModal.test.tsx` (créé à l'étape suivante, ce test est pour le store uniquement)

- [ ] **Step 1 : Ajouter les types dans `src/types.ts`**

Dans la section `// UI` de l'interface `AppState` (après `versionsModalOpen: boolean`), ajouter :

```ts
settingsModalOpen: boolean
```

Dans la section `// Actions` (après `closeVersionsModal`), ajouter :

```ts
openSettingsModal: () => void
closeSettingsModal: () => void
```

- [ ] **Step 2 : Ajouter l'état et les actions dans `src/store/appStore.ts`**

Dans l'objet initial du store (après `versionsModalOpen: false`), ajouter :

```ts
settingsModalOpen: false,
```

Dans les actions (après `closeVersionsModal: () => set({ versionsModalOpen: false })`), ajouter :

```ts
openSettingsModal: () => set({ settingsModalOpen: true }),
closeSettingsModal: () => set({ settingsModalOpen: false }),
```

- [ ] **Step 3 : Commit**

```bash
git add src/types.ts src/store/appStore.ts
git commit -m "feat: add settingsModalOpen state to store"
```

---

### Task 2 : Clés i18n pour le modal Paramètres et le sous-menu Save

**Files:**
- Modify: `src/i18n/translations.ts`

- [ ] **Step 1 : Ajouter les clés dans la section `fr` de `src/i18n/translations.ts`**

Après la clé `"sidebar.recentProjects"`, ajouter dans `fr` :

```ts
"sidebar.settings": "Paramètres",
"sidebar.saveMenu": "Enregistrer",
"sidebar.saveAsFull": "Enregistrer sous…",
// Settings modal
"settings.title": "Paramètres",
"settings.sectionInterface": "Interface",
"settings.language": "Langue",
"settings.langFr": "Français",
"settings.langEn": "English",
"settings.sectionCompilation": "Compilation",
"settings.comingSoon": "Bientôt disponible",
```

- [ ] **Step 2 : Ajouter les mêmes clés dans la section `en`**

Après `"sidebar.recentProjects": "Recent projects"`, ajouter dans `en` :

```ts
"sidebar.settings": "Settings",
"sidebar.saveMenu": "Save",
"sidebar.saveAsFull": "Save As…",
// Settings modal
"settings.title": "Settings",
"settings.sectionInterface": "Interface",
"settings.language": "Language",
"settings.langFr": "Français",
"settings.langEn": "English",
"settings.sectionCompilation": "Compilation",
"settings.comingSoon": "Coming soon",
```

- [ ] **Step 3 : Commit**

```bash
git add src/i18n/translations.ts
git commit -m "feat: add i18n keys for settings modal and save submenu"
```

---

### Task 3 : Créer SettingsModal

**Files:**
- Create: `src/components/Settings/SettingsModal.tsx`
- Create: `src/components/Settings/SettingsModal.test.tsx`

- [ ] **Step 1 : Écrire le test dans `src/components/Settings/SettingsModal.test.tsx`**

```tsx
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { SettingsModal } from './SettingsModal'

const mockSetLanguage = vi.fn()

vi.mock('../../store/appStore', () => ({
  useAppStore: () => ({
    language: 'fr',
    setLanguage: mockSetLanguage,
  }),
}))

vi.mock('../../i18n/useTranslation', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}))

describe('SettingsModal', () => {
  beforeEach(() => mockSetLanguage.mockClear())

  it('renders settings title', () => {
    render(<SettingsModal onClose={vi.fn()} />)
    expect(screen.getByText('settings.title')).toBeTruthy()
  })

  it('calls onClose when backdrop clicked', () => {
    const onClose = vi.fn()
    const { container } = render(<SettingsModal onClose={onClose} />)
    fireEvent.click(container.firstChild as Element)
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('calls onClose when X button clicked', () => {
    const onClose = vi.fn()
    render(<SettingsModal onClose={onClose} />)
    fireEvent.click(screen.getByTitle('close'))
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('calls setLanguage with en when EN button clicked', () => {
    render(<SettingsModal onClose={vi.fn()} />)
    fireEvent.click(screen.getByText('settings.langEn'))
    expect(mockSetLanguage).toHaveBeenCalledWith('en')
  })
})
```

- [ ] **Step 2 : Lancer le test pour vérifier qu'il échoue**

```bash
cd /srv/projets/typst-editor && npx vitest run src/components/Settings/SettingsModal.test.tsx
```

Résultat attendu : FAIL — module not found

- [ ] **Step 3 : Créer `src/components/Settings/SettingsModal.tsx`**

```tsx
import { FaGear, FaXmark } from 'react-icons/fa6'
import { useAppStore } from '../../store/appStore'
import { useTranslation } from '../../i18n/useTranslation'

interface Props {
  onClose: () => void
}

export function SettingsModal({ onClose }: Props) {
  const { language, setLanguage } = useAppStore()
  const { t } = useTranslation()

  function handleBackdropClick(e: React.MouseEvent) {
    if (e.target === e.currentTarget) onClose()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={handleBackdropClick}
    >
      <div className="bg-[#181825] border border-[#313244] rounded-lg shadow-2xl w-[420px] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#313244]">
          <div className="flex items-center gap-2 text-[#a6adc8] text-xs font-bold uppercase tracking-widest">
            <FaGear size={11} />
            {t('settings.title')}
          </div>
          <button
            title="close"
            onClick={onClose}
            className="text-[#585b70] hover:text-[#cdd6f4] transition-colors"
          >
            <FaXmark size={14} />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 flex flex-col gap-5">
          {/* Section Interface */}
          <div>
            <div className="text-[9px] font-bold uppercase tracking-widest text-[#585b70] mb-3">
              {t('settings.sectionInterface')}
            </div>

            {/* Language */}
            <div className="flex items-center justify-between py-2 border-b border-[#313244]/50">
              <span className="text-sm text-[#a6adc8]">{t('settings.language')}</span>
              <div className="flex gap-1">
                <button
                  onClick={() => setLanguage('fr')}
                  className={`px-3 py-1 rounded text-xs font-semibold transition-colors ${
                    language === 'fr'
                      ? 'bg-[#89b4fa] text-[#11111b]'
                      : 'text-[#585b70] hover:text-[#cdd6f4] hover:bg-[#313244]'
                  }`}
                >
                  {t('settings.langFr')}
                </button>
                <button
                  onClick={() => setLanguage('en')}
                  className={`px-3 py-1 rounded text-xs font-semibold transition-colors ${
                    language === 'en'
                      ? 'bg-[#89b4fa] text-[#11111b]'
                      : 'text-[#585b70] hover:text-[#cdd6f4] hover:bg-[#313244]'
                  }`}
                >
                  {t('settings.langEn')}
                </button>
              </div>
            </div>
          </div>

          {/* Section Compilation */}
          <div>
            <div className="text-[9px] font-bold uppercase tracking-widest text-[#585b70] mb-3">
              {t('settings.sectionCompilation')}
            </div>
            <div className="py-2 text-xs text-[#45475a] italic">
              {t('settings.comingSoon')}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 4 : Lancer le test pour vérifier qu'il passe**

```bash
cd /srv/projets/typst-editor && npx vitest run src/components/Settings/SettingsModal.test.tsx
```

Résultat attendu : PASS (4 tests)

- [ ] **Step 5 : Commit**

```bash
git add src/components/Settings/SettingsModal.tsx src/components/Settings/SettingsModal.test.tsx
git commit -m "feat: add SettingsModal component with language selector"
```

---

### Task 4 : Câbler SettingsModal dans App.tsx

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1 : Ajouter l'import et le câblage dans `src/App.tsx`**

Ajouter l'import (après l'import VersionsModal) :

```tsx
import { SettingsModal } from './components/Settings/SettingsModal'
```

Étendre la destructuration du store (ligne ~16) en ajoutant `settingsModalOpen, closeSettingsModal` :

```tsx
const { explorerVisible, previewVisible, diagnosticsVisible, searchVisible, toggleSearch, versionsModalOpen, closeVersionsModal, settingsModalOpen, closeSettingsModal, setProgress, activePage } = useAppStore()
```

Ajouter le composant conditionnel à la fin du JSX (après `{versionsModalOpen && <VersionsModal .../>}`) :

```tsx
{settingsModalOpen && <SettingsModal onClose={closeSettingsModal} />}
```

- [ ] **Step 2 : Vérifier que le build TypeScript est propre**

```bash
cd /srv/projets/typst-editor && npx tsc --noEmit
```

Résultat attendu : aucune erreur

- [ ] **Step 3 : Commit**

```bash
git add src/App.tsx
git commit -m "feat: wire SettingsModal in App.tsx"
```

---

### Task 5 : Refactoriser Sidebar — nouveau groupement + sous-menu Save

**Files:**
- Modify: `src/components/Sidebar.tsx`
- Modify: `src/components/Sidebar.test.tsx`

- [ ] **Step 1 : Mettre à jour le test Sidebar**

Remplacer le contenu de `src/components/Sidebar.test.tsx` par :

```tsx
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { Sidebar } from './Sidebar'

vi.mock('../tauri/commands', () => ({
  newProject: vi.fn(),
  openProject: vi.fn(),
  exportProject: vi.fn(),
  saveProject: vi.fn(),
  writeFile: vi.fn(),
  cleanupTmp: vi.fn(),
  createVersion: vi.fn(),
}))

vi.mock('../store/appStore', () => ({
  useAppStore: () => ({
    tmpPath: '/tmp/proj',
    typzPath: null,
    entryFile: 'main.typ',
    openFiles: [],
    activeFile: null,
    toggleDiagnostics: vi.fn(),
    setProject: vi.fn(),
    setProgress: vi.fn(),
    diagnosticsVisible: false,
    explorerVisible: true,
    previewVisible: true,
    searchVisible: false,
    toggleExplorer: vi.fn(),
    togglePreview: vi.fn(),
    toggleSearch: vi.fn(),
    recentProjects: [],
    addRecentProject: vi.fn(),
    removeRecentProject: vi.fn(),
    markFileSaved: vi.fn(),
    setTypzPath: vi.fn(),
    openFile: vi.fn(),
    openVersionsModal: vi.fn(),
    openSettingsModal: vi.fn(),
    language: 'fr',
  }),
}))

vi.mock('@tauri-apps/plugin-dialog', () => ({
  open: vi.fn(),
  save: vi.fn(),
}))

vi.mock('@tauri-apps/plugin-opener', () => ({
  openUrl: vi.fn(),
}))

describe('Sidebar', () => {
  it('renders export button', () => {
    render(<Sidebar />)
    expect(screen.getByTitle('Exporter')).toBeTruthy()
  })

  it('shows export menu on click', async () => {
    render(<Sidebar />)
    fireEvent.click(screen.getByTitle('Exporter'))
    expect(await screen.findByText('PDF')).toBeTruthy()
    expect(screen.getByText('PNG')).toBeTruthy()
    expect(screen.getByText('SVG')).toBeTruthy()
  })

  it('shows save submenu on click', async () => {
    render(<Sidebar />)
    fireEvent.click(screen.getByTitle('sidebar.saveMenu'))
    expect(await screen.findByText('sidebar.saveMenu')).toBeTruthy()
    expect(screen.getByText('sidebar.saveAsFull')).toBeTruthy()
  })

  it('renders settings button', () => {
    render(<Sidebar />)
    expect(screen.getByTitle('sidebar.settings')).toBeTruthy()
  })
})
```

- [ ] **Step 2 : Lancer les tests pour vérifier qu'ils échouent**

```bash
cd /srv/projets/typst-editor && npx vitest run src/components/Sidebar.test.tsx
```

Résultat attendu : les 2 nouveaux tests échouent (settings button, save submenu)

- [ ] **Step 3 : Mettre à jour les imports dans `src/components/Sidebar.tsx`**

Remplacer la liste d'imports react-icons par :

```tsx
import {
  FaFolderPlus,
  FaFolderOpen,
  FaFileExport,
  FaFilePdf,
  FaFileImage,
  FaVectorSquare,
  FaTerminal,
  FaTableColumns,
  FaEye,
  FaFloppyDisk,
  FaArrowsDownToLine,
  FaMagnifyingGlass,
  FaXmark,
  FaCircleQuestion,
  FaClockRotateLeft,
  FaGear,
} from 'react-icons/fa6'
```

- [ ] **Step 4 : Ajouter `saveOpen` et `openSettingsModal` au state/destructuring**

Dans le composant `Sidebar`, ajouter `saveOpen` à côté de `exportOpen` dans le useState :

```tsx
const [saveOpen, setSaveOpen] = useState(false)
```

Ajouter `openSettingsModal` à la destructuration du store (après `openVersionsModal`) et **supprimer** `language` et `setLanguage` qui ne sont plus utilisés dans Sidebar (ils passent dans SettingsModal) :

```tsx
openSettingsModal,
// supprimer ces deux lignes :
// language,
// setLanguage,
```

Étendre le `useEffect` du click-outside pour fermer aussi `saveOpen` :

```tsx
useEffect(() => {
  function handleClick(e: MouseEvent) {
    if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
      setExportOpen(false)
      setRecentOpen(false)
      setSaveOpen(false)
    }
  }
  document.addEventListener('mousedown', handleClick)
  return () => document.removeEventListener('mousedown', handleClick)
}, [])
```

- [ ] **Step 5 : Remplacer la section `{/* Render */}` de Sidebar**

Remplacer tout le bloc `return (...)` par :

```tsx
return (
  <div className="w-11 bg-[#181825] flex flex-col items-center py-3 gap-1 border-r border-[#313244] flex-shrink-0 relative z-20">
    {/* Logo */}
    <div className="w-7 h-7 bg-[#89b4fa] rounded-md flex items-center justify-center text-[#11111b] font-black text-sm mb-2">
      T
    </div>

    {/* ── Groupe 1 : Projet ── */}
    <div className="flex flex-col gap-1 items-center" ref={menuRef}>
      {/* Nouveau projet */}
      <button
        title={t('sidebar.newProject')}
        onClick={handleNewProject}
        className="w-8 h-8 flex items-center justify-center text-[#585b70] hover:text-[#cdd6f4] hover:bg-[#313244] rounded-md transition-colors"
      >
        <FaFolderPlus size={15} />
      </button>

      {/* Ouvrir / Récents */}
      <div className="relative">
        <button
          title={t('sidebar.openProject')}
          onClick={() => { setSaveOpen(false); setRecentOpen((o) => !o) }}
          className="w-8 h-8 flex items-center justify-center text-[#585b70] hover:text-[#cdd6f4] hover:bg-[#313244] rounded-md transition-colors relative"
        >
          <FaFolderOpen size={15} />
          <span className="absolute bottom-1 right-1 w-1 h-1 rounded-full bg-[#89b4fa] opacity-70" />
        </button>

        {recentOpen && (
          <div className="absolute left-10 top-0 bg-[#313244] border border-[#45475a] rounded-lg w-72 shadow-xl z-50 flex flex-col max-h-[70vh]">
            <div className="px-3 py-1.5 text-[9px] font-bold uppercase tracking-widest text-[#585b70] border-b border-[#45475a]">
              {t('recent.title')}
            </div>
            <div className="flex-1 overflow-y-auto">
              {recentProjects.length === 0 ? (
                <div className="px-3 py-3 text-[10px] text-[#585b70]">{t('recent.empty')}</div>
              ) : (
                recentProjects.map((path) => {
                  const normalized = path.replace(/\\/g, '/')
                  const name = normalized.split('/').pop()?.replace(/\.typz$/i, '') ?? path
                  const dir = normalized.split('/').slice(0, -1).join('/')
                  return (
                    <div
                      key={path}
                      className="flex items-center gap-2 px-3 py-2 hover:bg-[#45475a] transition-colors group cursor-pointer border-b border-[#45475a]/40"
                      onClick={() => handleOpenFromRecent(path)}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="text-[#cdd6f4] text-[11px] font-medium truncate">{name}</div>
                        <div className="text-[9px] text-[#585b70] truncate">{dir}</div>
                      </div>
                      <button
                        onClick={(e) => { e.stopPropagation(); removeRecentProject(path) }}
                        title={t('recent.remove')}
                        className="opacity-0 group-hover:opacity-100 text-[#585b70] hover:text-[#f38ba8] transition-all shrink-0"
                      >
                        <FaXmark size={10} />
                      </button>
                    </div>
                  )
                })
              )}
            </div>
            <div className="border-t border-[#45475a] p-1.5">
              <button
                onClick={() => { setRecentOpen(false); handleOpenProject() }}
                className="w-full flex items-center gap-2 px-2 py-1.5 text-[10px] text-[#a6adc8] hover:text-[#cdd6f4] hover:bg-[#45475a] rounded-md transition-colors"
              >
                <FaFolderOpen size={10} />
                {t('recent.browse')}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Enregistrer (sous-menu) */}
      <div className="relative">
        <button
          title={t('sidebar.saveMenu')}
          disabled={!tmpPath}
          onClick={() => { setRecentOpen(false); setSaveOpen((o) => !o) }}
          className="w-8 h-8 flex items-center justify-center text-[#585b70] hover:text-[#cdd6f4] hover:bg-[#313244] rounded-md transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-[#585b70] relative"
        >
          <FaFloppyDisk size={14} />
          <span className="absolute bottom-1 right-1 w-1 h-1 rounded-full bg-[#89b4fa] opacity-70" />
        </button>

        {saveOpen && (
          <div className="absolute left-10 top-0 bg-[#313244] border border-[#45475a] rounded-lg w-44 shadow-xl overflow-hidden z-50">
            <div className="px-3 py-1.5 text-[9px] font-bold uppercase tracking-widest text-[#585b70] border-b border-[#45475a]">
              {t('sidebar.saveMenu')}
            </div>
            <button
              onClick={() => { setSaveOpen(false); handleSave() }}
              className="w-full px-3 py-2 flex items-center gap-2.5 hover:bg-[#45475a] transition-colors text-left"
            >
              <div className="w-7 h-7 rounded-md bg-[#89b4fa20] text-[#89b4fa] flex items-center justify-center text-sm flex-shrink-0">
                <FaFloppyDisk size={12} />
              </div>
              <div>
                <div className="text-[#cdd6f4] font-semibold text-[11px]">{t('sidebar.saveMenu')}</div>
                <div className="text-[#585b70] text-[9px]">Ctrl+S</div>
              </div>
            </button>
            <button
              onClick={() => { setSaveOpen(false); handleSaveAs() }}
              className="w-full px-3 py-2 flex items-center gap-2.5 hover:bg-[#45475a] transition-colors text-left"
            >
              <div className="w-7 h-7 rounded-md bg-[#fab38720] text-[#fab387] flex items-center justify-center text-sm flex-shrink-0">
                <FaArrowsDownToLine size={12} />
              </div>
              <div>
                <div className="text-[#cdd6f4] font-semibold text-[11px]">{t('sidebar.saveAsFull')}</div>
                <div className="text-[#585b70] text-[9px]">Ctrl+Shift+S</div>
              </div>
            </button>
          </div>
        )}
      </div>
    </div>

    <div className="h-px bg-[#313244] w-6 mx-auto my-1" />

    {/* ── Groupe 2 : Vues ── */}
    <div className="flex flex-col gap-1 items-center">
      <button
        title={t('sidebar.explorer')}
        onClick={toggleExplorer}
        className={`w-8 h-8 flex items-center justify-center rounded-md transition-colors ${
          explorerVisible ? 'bg-[#89b4fa] text-[#11111b] hover:bg-[#74c7ec]' : 'text-[#585b70] hover:text-[#cdd6f4] hover:bg-[#313244]'
        }`}
      >
        <FaTableColumns size={13} />
      </button>
      <button
        title={t('sidebar.preview')}
        onClick={togglePreview}
        className={`w-8 h-8 flex items-center justify-center rounded-md transition-colors ${
          previewVisible ? 'bg-[#89b4fa] text-[#11111b] hover:bg-[#74c7ec]' : 'text-[#585b70] hover:text-[#cdd6f4] hover:bg-[#313244]'
        }`}
      >
        <FaEye size={13} />
      </button>
      <button
        title={t('sidebar.search')}
        onClick={toggleSearch}
        className={`w-8 h-8 flex items-center justify-center rounded-md transition-colors ${
          searchVisible ? 'bg-[#89b4fa] text-[#11111b] hover:bg-[#74c7ec]' : 'text-[#585b70] hover:text-[#cdd6f4] hover:bg-[#313244]'
        }`}
      >
        <FaMagnifyingGlass size={13} />
      </button>
      <button
        title={t('sidebar.diagnostics')}
        onClick={toggleDiagnostics}
        className={`w-8 h-8 flex items-center justify-center rounded-md transition-colors ${
          diagnosticsVisible ? 'bg-[#89b4fa] text-[#11111b] hover:bg-[#74c7ec]' : 'text-[#585b70] hover:text-[#cdd6f4] hover:bg-[#313244]'
        }`}
      >
        <FaTerminal size={13} />
      </button>
    </div>

    {/* Spacer */}
    <div className="flex-1" />

    {/* ── Groupe 3 : Outils ── */}
    <div className="flex flex-col gap-1 items-center">
      <button
        title={t('sidebar.history')}
        onClick={openVersionsModal}
        disabled={!tmpPath}
        className="w-8 h-8 flex items-center justify-center rounded-md transition-colors disabled:opacity-40 disabled:cursor-not-allowed text-[#585b70] hover:text-[#cdd6f4] hover:bg-[#313244]"
      >
        <FaClockRotateLeft size={13} />
      </button>

      {/* Export */}
      <div className="relative">
        <button
          title={t('sidebar.export')}
          disabled={!tmpPath}
          onClick={() => setExportOpen((o) => !o)}
          className="w-8 h-8 flex items-center justify-center bg-[#89b4fa] text-[#11111b] rounded-md hover:bg-[#74c7ec] transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-[#89b4fa] relative"
        >
          <FaFileExport size={15} />
          <span className="absolute bottom-1 right-1 w-1 h-1 rounded-full bg-[#11111b] opacity-50" />
        </button>

        {exportOpen && (
          <div className="absolute left-10 bottom-0 bg-[#313244] border border-[#45475a] rounded-lg w-44 shadow-xl overflow-hidden z-50">
            <div className="px-3 py-1.5 text-[9px] font-bold uppercase tracking-widest text-[#585b70] border-b border-[#45475a]">
              {t('sidebar.exportTitle')}
            </div>
            {[
              { format: 'pdf' as const, icon: <FaFilePdf />, label: 'PDF', desc: t('sidebar.exportPdfDesc'), color: 'text-[#f38ba8]', bg: 'bg-[#f38ba820]' },
              { format: 'png' as const, icon: <FaFileImage />, label: 'PNG', desc: t('sidebar.exportPngDesc'), color: 'text-[#a6e3a1]', bg: 'bg-[#a6e3a120]' },
              { format: 'svg' as const, icon: <FaVectorSquare />, label: 'SVG', desc: t('sidebar.exportSvgDesc'), color: 'text-[#89b4fa]', bg: 'bg-[#89b4fa20]' },
            ].map(({ format, icon, label, desc, color, bg }) => (
              <button
                key={format}
                onClick={() => handleExport(format)}
                className="w-full px-3 py-2 flex items-center gap-2.5 hover:bg-[#45475a] transition-colors text-left"
              >
                <div className={`w-7 h-7 rounded-md ${bg} ${color} flex items-center justify-center text-sm flex-shrink-0`}>
                  {icon}
                </div>
                <div>
                  <div className="text-[#cdd6f4] font-semibold text-[11px]">{label}</div>
                  <div className="text-[#585b70] text-[9px]">{desc}</div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="h-px bg-[#313244] w-6 mx-auto my-1" />

      {/* Paramètres */}
      <button
        title={t('sidebar.settings')}
        onClick={openSettingsModal}
        className="w-8 h-8 flex items-center justify-center text-[#cba6f7] hover:text-[#cdd6f4] hover:bg-[#313244] rounded-md transition-colors"
      >
        <FaGear size={13} />
      </button>

      {/* Aide */}
      <button
        title={t('sidebar.help')}
        onClick={() => openUrl('https://typst.app/docs/')}
        className="w-8 h-8 flex items-center justify-center text-[#45475a] hover:text-[#cdd6f4] hover:bg-[#313244] rounded-md transition-colors"
      >
        <FaCircleQuestion size={13} />
      </button>
    </div>

    {/* Save-before-switch dialog */}
    {pendingSwitch !== 'none' && (
      <Dialog
        title={t('sidebar.unsavedTitle')}
        onClose={() => setPendingSwitch('none')}
        actions={
          <>
            <button
              onClick={() => setPendingSwitch('none')}
              className="px-3 py-1.5 text-xs text-[#a6adc8] hover:text-[#cdd6f4] rounded-md hover:bg-[#313244] transition-colors"
            >
              {t('sidebar.cancel')}
            </button>
            <button
              onClick={handleDiscardAndSwitch}
              className="px-3 py-1.5 text-xs text-[#f38ba8] hover:text-[#cdd6f4] rounded-md hover:bg-[#313244] transition-colors"
            >
              {t('sidebar.dontSave')}
            </button>
            <button
              onClick={handleSaveAndSwitch}
              className="px-3 py-1.5 text-xs bg-[#89b4fa] text-[#11111b] rounded-md hover:bg-[#74c7ec] transition-colors"
            >
              {t('sidebar.saveBtn')}
            </button>
          </>
        }
      >
        <p className="text-sm text-[#a6adc8]">
          {t('sidebar.unsavedMessage')}
          <br />
          <span className="text-xs text-[#585b70] mt-1 block">{t('sidebar.unsavedHint')}</span>
        </p>
      </Dialog>
    )}
  </div>
)
```

- [ ] **Step 6 : Lancer tous les tests**

```bash
cd /srv/projets/typst-editor && npx vitest run
```

Résultat attendu : tous les tests passent

- [ ] **Step 7 : Vérifier TypeScript**

```bash
cd /srv/projets/typst-editor && npx tsc --noEmit
```

Résultat attendu : aucune erreur

- [ ] **Step 8 : Commit**

```bash
git add src/components/Sidebar.tsx src/components/Sidebar.test.tsx
git commit -m "feat: reorganize sidebar — projet/vues/outils groups, save submenu, settings button"
```

---

### Task 6 : Vérification finale

**Files:** (aucun fichier modifié)

- [ ] **Step 1 : Lancer tous les tests**

```bash
cd /srv/projets/typst-editor && npx vitest run
```

Résultat attendu : tous les tests passent

- [ ] **Step 2 : Lancer le build complet**

```bash
cd /srv/projets/typst-editor && npm run build
```

Résultat attendu : build sans erreur

- [ ] **Step 3 : Push**

```bash
cd /srv/projets/typst-editor && git push
```
