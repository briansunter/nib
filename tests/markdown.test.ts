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

  it('keeps layout frontmatter separate from page metadata', () => {
    const compiled = markdownToCompiledPage('---\ntitle: Hello\nlayout: docs\n---\n# World')
    expect(compiled.meta).toEqual({ title: 'Hello' })
    expect(compiled.layout).toBe('docs')
  })

  it('rejects invalid Markdown layouts while compiling', () => {
    expect(() => markdownToCompiledPage('---\nlayout: ../docs\n---\n# World'))
      .toThrow('Markdown layout must be a flat name')
    expect(() => markdownToCompiledPage('---\nlayout: 42\n---\n# World'))
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
    const compiled = markdownToCompiledPage('# World', {
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
    markdownToCompiledPage('# World', {
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
  })
})
