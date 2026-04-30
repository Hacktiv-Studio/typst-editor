import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { OpenFilesList } from './OpenFilesList'
import { useAppStore } from '../../store/appStore'

beforeEach(() => {
  useAppStore.setState({
    openFiles: [
      { path: 'main.typ', content: '', isDirty: false },
      { path: 'chapter1.typ', content: '', isDirty: true },
    ],
    activeFile: 'main.typ',
  } as any)
})

describe('OpenFilesList', () => {
  it('renders open files', () => {
    render(<OpenFilesList />)
    expect(screen.getByText('main.typ')).toBeTruthy()
    expect(screen.getByText('chapter1.typ')).toBeTruthy()
  })

  it('calls closeFile on xmark click', () => {
    const closeFile = vi.fn()
    useAppStore.setState({ closeFile } as any)
    render(<OpenFilesList />)
    const buttons = screen.getAllByRole('button')
    fireEvent.click(buttons[0])
    expect(closeFile).toHaveBeenCalled()
  })
})
