import { describe, expect, it, vi } from 'vitest'
import {
  needsStaticPageReload,
  nibClientEntry,
} from '../src/framework/client-entry-plugin'

describe('client entry integration', () => {
  it('full-reloads changes to configuration and application source', () => {
    expect(needsStaticPageReload('/site/nib.config.ts')).toBe(true)
    expect(needsStaticPageReload('/site/src/pages/page.tsx')).toBe(true)
    expect(needsStaticPageReload('/site/src/enhancements/search/index.client.ts')).toBe(true)
    expect(needsStaticPageReload('/site/src/islands/counter.tsx')).toBe(true)
    expect(needsStaticPageReload('/site/src/client.ts')).toBe(true)
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
