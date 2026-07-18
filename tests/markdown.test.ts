import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { markdownToCompiledPage } from '../src/framework/markdown'
import { nibMarkdown } from '../src/framework/vite-plugin'

describe('markdown', () => {
  it('compiles GFM Markdown and frontmatter', () => {
    const compiled = markdownToCompiledPage('---\ntitle: Hello\n---\n~~old~~\n\n- [x] done')
    expect(compiled.meta.title).toBe('Hello')
    expect(compiled.html).toContain('<del>old</del>')
    expect(compiled.layout).toBeUndefined()
  })

  it('keeps layout frontmatter separate from page metadata', () => {
    const compiled = markdownToCompiledPage('---\ntitle: Hello\nlayout: docs\n---\n# World')
    expect(compiled.meta).toEqual({ title: 'Hello' })
    expect(compiled.layout).toBe('docs')
  })

  it('rejects invalid Markdown layouts while compiling', () => {
    expect(() => markdownToCompiledPage('---\nlayout: ../docs\n---\n# World'))
      .toThrow('Markdown layout must be a flat name')
    expect(() => markdownToCompiledPage('---\nlayout: 42\n---\n# World'))
      .toThrow('Markdown layout must be a non-empty string')
  })

  it('generates a Vite module that imports the named layout', async () => {
    const plugin = nibMarkdown()
    if (typeof plugin.load !== 'function') throw new Error('Markdown plugin has no load hook')

    const load = plugin.load as (id: string) => Promise<unknown>
    const result = await load(path.resolve('src/pages/docs/getting-started/page.md'))
    if (typeof result !== 'string') throw new Error('Markdown plugin did not return module source')

    expect(result).toContain('import Layout from "/src/layouts/docs.tsx"')
    expect(result).toContain('createElement(Layout, null, content)')
  })
})
