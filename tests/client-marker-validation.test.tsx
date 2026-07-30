import { createElement } from 'react'
import { describe, expect, it } from 'vitest'
import { Behavior } from '../src/framework/behaviors'
import { island } from '../src/framework/islands'
import { createProjectRenderer } from '../src/framework/project-renderer'

const OutsideIsland = island(() => <p>Interactive</p>)

const config = {}

describe('project client marker validation', () => {
  it('rejects an island definition rendered outside the discovered islands directory', async () => {
    const renderer = await createProjectRenderer({
      config,
      root: process.cwd(),
      base: '/',
      pages: {
        '/src/pages/page.tsx': {
          default: () => <OutsideIsland />,
          meta: { title: 'Island' },
        },
      },
      islandModules: {},
    })

    expect(() => renderer.render('/')).toThrow(
      'must be the default export of a module under src/islands',
    )
  })

  it('rejects a declared behavior without its matching client module', async () => {
    const renderer = await createProjectRenderer({
      config,
      root: process.cwd(),
      base: '/',
      pages: {
        '/src/pages/page.tsx': {
          default: () => <Behavior name="missing" />,
          meta: { title: 'Behavior' },
        },
      },
      islandModules: {},
      behaviorClientFiles: [],
    })

    expect(() => renderer.render('/')).toThrow(
      'Route / emitted behavior "missing" without a matching client module in '
      + 'src/**/*.client.{js,jsx,mjs,cjs,ts,tsx,mts,cts}',
    )
  })

  it('accepts discovered module IDs and ignores unsupported hand-authored markers', async () => {
    function Page() {
      return (
        <>
          <OutsideIsland />
          <Behavior name="missing" />
          {createElement('nib-behavior', { 'data-behavior': 'raw' }, 'Raw marker')}
        </>
      )
    }
    const renderer = await createProjectRenderer({
      config,
      root: process.cwd(),
      base: '/',
      pages: { '/src/pages/page.tsx': { default: Page, meta: { title: 'Markers' } } },
      islandModules: {
        '/src/islands/outside.tsx': { default: OutsideIsland },
      },
      behaviorClientFiles: ['/src/behaviors/missing.client.ts'],
    })

    const output = renderer.render('/')
    if (output.kind !== 'page') throw new Error('Expected page output')
    expect(output.page.islands).toEqual(['outside'])
    expect(output.page.behaviors).toEqual(['missing'])
    expect(output.page.html).toContain('data-behavior="raw"')
  })
})
