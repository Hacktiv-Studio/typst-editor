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
