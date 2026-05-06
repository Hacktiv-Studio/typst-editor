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

vi.mock('../i18n/useTranslation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}))

describe('Sidebar', () => {
  it('renders export button', () => {
    render(<Sidebar />)
    expect(screen.getByTitle('sidebar.export')).toBeTruthy()
  })

  it('shows export menu on click', async () => {
    render(<Sidebar />)
    fireEvent.click(screen.getByTitle('sidebar.export'))
    expect(await screen.findByText('PDF')).toBeTruthy()
    expect(screen.getByText('PNG')).toBeTruthy()
    expect(screen.getByText('SVG')).toBeTruthy()
  })

  it('shows save submenu on click', async () => {
    render(<Sidebar />)
    fireEvent.click(screen.getByTitle('sidebar.saveMenu'))
    expect((await screen.findAllByText('sidebar.saveMenu')).length).toBeGreaterThan(0)
    expect(screen.getByText('sidebar.saveAsFull')).toBeTruthy()
  })

  it('renders settings button', () => {
    render(<Sidebar />)
    expect(screen.getByTitle('sidebar.settings')).toBeTruthy()
  })
})
