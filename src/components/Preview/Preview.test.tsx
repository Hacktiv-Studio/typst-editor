import { render } from '@testing-library/react'
import { describe, it, expect, beforeEach } from 'vitest'
import { PagesViewer } from './PagesViewer'
import { useAppStore } from '../../store/appStore'

const SVG_PAGE = '<svg xmlns="http://www.w3.org/2000/svg" width="595" height="842"><rect fill="white" width="595" height="842"/></svg>'

beforeEach(() => {
  useAppStore.setState({ pages: [SVG_PAGE, SVG_PAGE], activePage: 0, zoom: 1 } as any)
})

describe('PagesViewer', () => {
  it('renders correct number of pages', () => {
    render(<PagesViewer />)
    const pages = document.querySelectorAll('[data-page]')
    expect(pages).toHaveLength(2)
  })
})
