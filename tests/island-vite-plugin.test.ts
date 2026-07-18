import { describe, expect, it, vi } from 'vitest'
import { needsStaticPageReload, nibIslandsEntry } from '../src/framework/island-vite-plugin'

describe('island Vite integration', () => {
  it('marks the generated module entry exactly once', () => {
    const hook = nibIslandsEntry().transformIndexHtml as {
      handler(html: string): string
    }
    const source = '<head><script type="module" src="/assets/index.js"></script></head>'
    const marked = hook.handler(source)

    expect(marked).toContain('<script data-nib-islands type="module"')
    expect(hook.handler(marked)).toBe(marked)
    expect(hook.handler('<head></head>')).toBe('<head></head>')
  })

  it('full-reloads static server-rendered modules but not island modules', () => {
    expect(needsStaticPageReload('/site/src/pages/about/page.tsx')).toBe(true)
    expect(needsStaticPageReload('C:\\site\\src\\layouts\\docs.tsx')).toBe(true)
    expect(needsStaticPageReload('/site/src/App.tsx')).toBe(true)
    expect(needsStaticPageReload('/site/src/site.config.ts')).toBe(true)
    expect(needsStaticPageReload('/site/src/islands/counter.tsx')).toBe(false)

    const send = vi.fn()
    const hook = nibIslandsEntry().handleHotUpdate as (context: unknown) => unknown
    expect(hook({
      file: '/site/src/pages/page.tsx',
      server: { ws: { send } },
    })).toEqual([])
    expect(send).toHaveBeenCalledWith({ type: 'full-reload' })
  })
})
