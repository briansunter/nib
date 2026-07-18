import { renderToStaticMarkup } from 'react-dom/server'
import type { ReactNode } from 'react'
import { describe, expect, it } from 'vitest'
import { markdownToCompiledPage, markdownToPageModule, renderMarkdown } from '../src/framework/markdown'

describe('markdown', () => {
  it('renders GFM markdown', () => {
    expect(renderMarkdown('~~old~~\n\n- [x] done')).toContain('<del>old</del>')
  })
  it('extracts frontmatter and creates a component', () => {
    const compiled = markdownToCompiledPage('---\ntitle: Hello\n---\n# World')
    expect(compiled.meta.title).toBe('Hello')
    expect(compiled.html).toContain('<h1>World</h1>')
    const page = markdownToPageModule('---\ntitle: Hello\n---\n# World')
    expect(page.meta?.title).toBe('Hello')
    expect(renderToStaticMarkup(<page.default />)).toContain('<h1>World</h1>')
  })

  it('wraps Markdown in a named layout from frontmatter', () => {
    const Layout = ({ children }: { children: ReactNode }) => <div data-layout="docs">{children}</div>
    const page = markdownToPageModule('---\ntitle: Hello\nlayout: docs\n---\n# World', {
      layouts: { docs: Layout },
    })

    expect(page.meta?.layout).toBe('docs')
    expect(renderToStaticMarkup(<page.default />)).toContain('<div data-layout="docs"><article')
  })

  it('rejects unknown Markdown layouts', () => {
    expect(() => markdownToPageModule('---\nlayout: missing\n---\n# World', { layouts: {} }))
      .toThrow('Unknown Markdown layout "missing"')
  })
})
