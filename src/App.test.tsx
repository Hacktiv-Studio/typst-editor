import React from 'react'
import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import App from './App'

vi.mock('./tauri/commands', () => ({
  onProgress: vi.fn(() => Promise.resolve(() => {})),
}))

vi.mock('react-resizable-panels', () => ({
  Group: ({ children, className }: { children: React.ReactNode; className?: string }) =>
    <div className={className}>{children}</div>,
  Panel: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Separator: ({ className }: { className?: string }) => <div className={className} />,
}))

describe('App layout', () => {
  it('renders without crashing', () => {
    render(<App />)
    expect(document.querySelector('.app-root')).toBeTruthy()
  })
})
