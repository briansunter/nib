import { describe, expect, it, vi } from 'vitest'
import {
  markBehaviorEntryScript,
  needsStaticPageReload,
  nibClientEntry,
} from '../src/framework/client-entry-plugin'

describe('behavior client entry integration', () => {
  it('marks only the generated behavior entry script', () => {
    const source = '<head><script type="module" src="/analytics.js"></script><!--nib-behaviors-entry--><script type="module" src="/assets/index.js"></script></head>'
    const marked = markBehaviorEntryScript(source)
    expect(marked).toContain(
      '<script data-nib-behaviors type="module" src="/assets/index.js"></script>',
    )
    expect(marked).toContain('<script type="module" src="/analytics.js"></script>')
    expect(markBehaviorEntryScript('<script type="module" src="/behaviors.js"></script>'))
      .not.toContain('data-nib-behaviors')
  })

  it('does not duplicate an existing behavior marker', () => {
    const source = '<!--nib-behaviors-entry--><script data-nib-behaviors type="module" src="/behaviors.js"></script>'
    expect(markBehaviorEntryScript(source).match(/data-nib-behaviors/g)).toHaveLength(1)
  })

  it('full-reloads changes to configuration and application source', () => {
    expect(needsStaticPageReload('/site/nib.config.ts')).toBe(true)
    expect(needsStaticPageReload('/site/src/pages/page.tsx')).toBe(true)
    expect(needsStaticPageReload('/site/src/behaviors/search/index.client.ts')).toBe(true)
    expect(needsStaticPageReload('/site/public/logo.svg')).toBe(false)
  })

  it('sends one full reload for a static source update', () => {
    const plugin = nibClientEntry()
    if (typeof plugin.handleHotUpdate !== 'function') {
      throw new Error('Expected a hot-update hook')
    }
    const send = vi.fn()
    const result = plugin.handleHotUpdate.call({} as never, {
      file: '/site/src/pages/page.tsx',
      server: { ws: { send } },
    } as never)
    expect(send).toHaveBeenCalledWith({ type: 'full-reload' })
    expect(result).toEqual([])
  })
})
