import { createElement } from 'react'
import { describe, expect, it } from 'vitest'
import { enhance } from '../src/framework/enhancements'
import { createProjectRenderer } from '../src/framework/project-renderer'

const config = {}

describe('project enhancement marker validation', () => {
  it('rejects a declared enhancement without its matching client module', async () => {
    const renderer = await createProjectRenderer({
      config,
      root: process.cwd(),
      base: '/',
      pages: {
        '/src/pages/page.tsx': {
          default: () => <div {...enhance('missing')} />,
          meta: { title: 'Enhancement' },
        },
      },
      enhancementClientFiles: [],
    })

    expect(() => renderer.render('/')).toThrow(
      'Route / emitted enhancement "missing" without a matching client module in '
      + 'src/enhancements/**/index.client.{js,ts}',
    )
  })

  it('accepts discovered directory index IDs and ignores unrelated attributes', async () => {
    function Page() {
      return (
        <>
          <div {...enhance('filters/search')}>Search</div>
          {createElement('div', { 'data-raw-marker': 'true' }, 'Raw marker')}
        </>
      )
    }
    const renderer = await createProjectRenderer({
      config,
      root: process.cwd(),
      base: '/',
      pages: { '/src/pages/page.tsx': { default: Page, meta: { title: 'Markers' } } },
      enhancementClientFiles: [
        '/src/enhancements/filters/search/index.client.ts',
      ],
    })

    const output = renderer.render('/')
    if (output.kind !== 'page') throw new Error('Expected page output')
    expect(output.page.enhancements).toEqual([
      { id: 'filters/search', when: 'load' },
    ])
    expect(output.page.html).toContain('data-raw-marker="true"')
  })

  it('rejects duplicate discovered IDs across canonical path forms', async () => {
    await expect(createProjectRenderer({
      config,
      root: process.cwd(),
      base: '/',
      pages: {},
      enhancementClientFiles: [
        '/src/enhancements/search/index.client.ts',
        './src/enhancements/search/index.client.ts',
      ],
    })).rejects.toThrow('Duplicate enhancement ID: search')
  })
})
