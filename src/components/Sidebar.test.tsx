import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { Sidebar } from './Sidebar'

vi.mock('../tauri/commands', () => ({
  newProject: vi.fn(),
  openProject: vi.fn(),
  exportProject: vi.fn(),
}))

vi.mock('../store/appStore', () => ({
  useAppStore: () => ({ tmpPath: '/tmp/proj', typzPath: null, entryFile: 'main.typ', toggleDiagnostics: vi.fn(), setProject: vi.fn(), setProgress: vi.fn() }),
}))

vi.mock('@tauri-apps/plugin-dialog', () => ({
  open: vi.fn(),
  save: vi.fn(),
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
})
