import { createElement } from 'react'
import { describe, expect, it } from 'vitest'
import { Behavior } from '../src/framework/behaviors'
import { createProjectRenderer } from '../src/framework/project-renderer'

const config = {}

describe('project behavior marker validation', () => {
  it('rejects a declared behavior without its matching client module', async () => {
    const renderer = await createProjectRenderer({
      config,
      root: process.cwd(),
      base: '/',
      pages: {
        '/src/pages/page.tsx': {
          default: () => <Behavior name="missing"><div /></Behavior>,
          meta: { title: 'Behavior' },
        },
      },
      behaviorClientFiles: [],
    })

    expect(() => renderer.render('/')).toThrow(
      'Route / emitted behavior "missing" without a matching client module in '
      + 'src/behaviors/**/index.client.{js,ts}',
    )
  })

  it('accepts discovered directory index IDs and ignores unrelated attributes', async () => {
    function Page() {
      return (
        <>
          <Behavior name="filters/search"><div>Search</div></Behavior>
          {createElement('div', { 'data-raw-marker': 'true' }, 'Raw marker')}
        </>
      )
    }
    const renderer = await createProjectRenderer({
      config,
      root: process.cwd(),
      base: '/',
      pages: { '/src/pages/page.tsx': { default: Page, meta: { title: 'Markers' } } },
      behaviorClientFiles: [
        '/src/behaviors/filters/search/index.client.ts',
      ],
    })

    const output = renderer.render('/')
    if (output.kind !== 'page') throw new Error('Expected page output')
    expect(output.page.behaviors).toEqual(['filters/search'])
    expect(output.page.html).toContain('data-raw-marker="true"')
  })

  it('rejects duplicate discovered IDs across canonical path forms', async () => {
    await expect(createProjectRenderer({
      config,
      root: process.cwd(),
      base: '/',
      pages: {},
      behaviorClientFiles: [
        '/src/behaviors/search/index.client.ts',
        './src/behaviors/search/index.client.ts',
      ],
    })).rejects.toThrow('Duplicate behavior ID: search')
  })
})
