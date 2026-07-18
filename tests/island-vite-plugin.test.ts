import { describe, expect, it, vi } from 'vitest'
import { needsStaticPageReload, nibIslandsEntry } from '../src/framework/island-vite-plugin'

describe('island Vite integration', () => {
  it('marks only the script with the dedicated island entry marker', () => {
    const hook = nibIslandsEntry().transformIndexHtml as {
      handler(html: string): string
    }
    const source = '<head><script type="module" src="/analytics.js"></script><!--nib-islands-entry--><script type="module" src="/assets/index.js"></script></head>'
    const marked = hook.handler(source)
    expect(marked).toContain('<script type="module" src="/analytics.js"></script>')
    expect(marked).toContain('<script data-nib-islands type="module" src="/assets/index.js"></script>')
    expect(hook.handler(marked)).toBe(marked)
    expect(hook.handler('<script type="module" src="/islands.js"></script>'))
      .not.toContain('data-nib-islands')
    expect(hook.handler('<head></head>')).toBe('<head></head>')
  })

  it('full-reloads static server-rendered modules but not island modules', () => {
    expect(needsStaticPageReload('/site/src/pages/about/page.tsx')).toBe(true)
    expect(needsStaticPageReload('C:\\site\\src\\layouts\\docs.tsx')).toBe(true)
    expect(needsStaticPageReload('/site/src/App.tsx')).toBe(true)
    expect(needsStaticPageReload('/site/src/site.config.ts')).toBe(true)
    expect(needsStaticPageReload('/site/src/routes.ts')).toBe(true)
    expect(needsStaticPageReload('/site/src/entry-server.tsx')).toBe(true)
    expect(needsStaticPageReload('/site/src/framework/markdown.ts')).toBe(true)
    expect(needsStaticPageReload('/site/src/entry-islands.tsx')).toBe(true)
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
