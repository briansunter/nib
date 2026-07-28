import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { markdownToCompiledPage } from '../src/framework/markdown'
import { nibMarkdown } from '../src/framework/vite-plugin'

describe('markdown', () => {
  it('compiles GFM Markdown and frontmatter', () => {
    const compiled = markdownToCompiledPage('---\ntitle: Hello\n---\n~~old~~\n\n- [x] done')
    expect(compiled.meta.title).toBe('Hello')
    expect(compiled.html).toContain('<del>old</del>')
    expect(compiled.layout).toBeUndefined()
  })

  it('allows a site to opt out of the built-in GFM pass', () => {
    const compiled = markdownToCompiledPage('---\ntitle: Literal\n---\n~~literal~~', { gfm: false })
    expect(compiled.html).toContain('~~literal~~')
    expect(compiled.html).not.toContain('<del>')
  })

  it('serializes trusted raw HTML when explicitly enabled', () => {
    const html = '---\ntitle: Embedded content\n---\n<div data-embed="owned">Embedded content</div>'
    expect(markdownToCompiledPage(html).html).not.toContain('<div data-embed="owned">')
    expect(markdownToCompiledPage(html, { allowDangerousHtml: true }).html)
      .toContain('<div data-embed="owned">Embedded content</div>')
  })

  it('keeps layout frontmatter separate from page metadata', () => {
    const compiled = markdownToCompiledPage('---\ntitle: Hello\nlayout: docs\n---\n# World')
    expect(compiled.meta).toEqual({ title: 'Hello' })
    expect(compiled.layout).toBe('docs')
  })

  it('preserves social metadata fields from Markdown frontmatter', () => {
    const compiled = markdownToCompiledPage(
      '---\n'
      + 'title: Hello\n'
      + 'image: /cover.png\n'
      + 'type: article\n'
      + 'twitterCard: summary\n'
      + 'layout: docs\n'
      + '---\n# World',
    )
    expect(compiled.meta).toEqual({
      title: 'Hello',
      image: '/cover.png',
      type: 'article',
      twitterCard: 'summary',
    })
    // Layout stays separate from the social metadata fields.
    expect(compiled.layout).toBe('docs')
    expect(compiled.meta).not.toHaveProperty('layout')
  })

  it('rejects invalid social metadata field types in Markdown frontmatter', () => {
    expect(() => markdownToCompiledPage('---\ntype: profile\n---\n# World'))
      .toThrow('Markdown frontmatter')
    expect(() => markdownToCompiledPage('---\ntwitterCard: hero\n---\n# World'))
      .toThrow('Markdown frontmatter')
  })

  it('rejects invalid Markdown layouts while compiling', () => {
    expect(() => markdownToCompiledPage('---\ntitle: World\nlayout: ../docs\n---\n# World'))
      .toThrow('Markdown layout must be a flat name')
    expect(() => markdownToCompiledPage('---\ntitle: World\nlayout: 42\n---\n# World'))
      .toThrow('Markdown frontmatter')
  })

  it('validates Markdown frontmatter types at the compiler seam', () => {
    expect(() => markdownToCompiledPage('---\ntitle: 42\n---\n# World'))
      .toThrow('Markdown frontmatter')
    expect(() => markdownToCompiledPage('---\ndescription: [wrong]\n---\n# World'))
      .toThrow('Markdown frontmatter')
    expect(() => markdownToCompiledPage('---\ndraft: "false"\n---\n# World'))
      .toThrow('Markdown frontmatter')
  })

  it('supports custom typed frontmatter while retaining page metadata', () => {
    const compiled = markdownToCompiledPage(
      '---\ntitle: Hello\ntags: [nib, typed]\n---\n# World',
      {
        schema: z.object({
          title: z.string(),
          tags: z.array(z.string()),
        }),
      },
    )
    expect(compiled.frontmatter.tags).toEqual(['nib', 'typed'])
    expect(compiled.meta.title).toBe('Hello')
  })

  it('applies configured remark and rehype plugins in pipeline order', () => {
    const compiled = markdownToCompiledPage('---\ntitle: World\n---\n# World', {
      remarkPlugins: [
        () => (tree: any) => {
          tree.children.push({
            type: 'paragraph',
            children: [{ type: 'text', value: 'Added by remark' }],
          })
        },
      ],
      rehypePlugins: [
        () => (tree: any) => {
          const heading = tree.children.find((node: any) => node.tagName === 'h1')
          heading.properties = { className: ['from-rehype'] }
        },
      ],
    })
    expect(compiled.html).toContain('<h1 class="from-rehype">World</h1>')
    expect(compiled.html).toContain('<p>Added by remark</p>')
  })

  it('passes the Markdown source path to Unified plugins', () => {
    let sourcePath: string | undefined
    markdownToCompiledPage('---\ntitle: World\n---\n# World', {
      remarkPlugins: [
        () => (_tree: any, file: { history: string[] }) => {
          sourcePath = file.history[0]
        },
      ],
    }, { file: '/project/src/pages/world/page.md' })
    expect(sourcePath).toBe('/project/src/pages/world/page.md')
  })

  it('generates a Vite module that exposes frontmatter for runtime layouts', async () => {
    const plugin = nibMarkdown()
    if (typeof plugin.load !== 'function') throw new Error('Markdown plugin has no load hook')

    const load = plugin.load as (id: string) => Promise<unknown>
    const result = await load(path.resolve('examples/docs/src/pages/docs/getting-started/page.md'))
    if (typeof result !== 'string') throw new Error('Markdown plugin did not return module source')

    expect(result).toContain('markdownToCompiledPage')
    expect(result).toContain('file:')
    expect(result).toContain('export const frontmatter = compiled.frontmatter')
    expect(result).toContain('export const layout = compiled.layout')
    expect(result).toContain('export const content = compiled.content')
    expect(result).toContain('className = defaultClassName')
    expect(result).toContain("defaultClassName = 'nib-markdown'")
    expect(result).not.toContain('prose-invert')
    expect(result).not.toContain('prose-a:text-')
    expect(result).toContain('...articleProps')
    expect(result).toContain('Content = NibContent')
    expect(result).not.toContain('dangerouslySetInnerHTML')
  })
})
