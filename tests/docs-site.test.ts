import fs from 'node:fs/promises'
import path from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import { buildSite } from '../src/framework/site'

const root = path.resolve('examples/docs')
const output = path.join(root, 'dist')

afterAll(async () => {
  await fs.rm(output, { recursive: true, force: true })
})

describe('Nib documentation site', () => {
  it('ships the docs shell, full navigation, and its stylesheet in static HTML', async () => {
    await buildSite({ root })

    const overview = await fs.readFile(path.join(output, 'client/docs/index.html'), 'utf8')
    const gettingStarted = await fs.readFile(
      path.join(output, 'client/docs/getting-started/index.html'),
      'utf8',
    )
    expect(overview).toMatch(/<link rel="stylesheet" href="\/assets\/[^"]+\.css" \/>/)
    expect(overview).toContain('<a class="skip-link" href="#content">Skip to content</a>')
    expect(overview).toContain('<aside class="docs-sidebar">')
    expect(overview).toContain('<details class="docs-menu" open="">')
    for (const href of [
      '/docs/',
      '/docs/getting-started/',
      '/docs/pages-and-routes/',
      '/docs/markdown-and-layouts/',
      '/docs/react-islands/',
      '/docs/github-pages/',
      '/docs/releases/',
    ]) {
      expect(overview).toContain(`href="${href}"`)
    }
    expect(overview).toContain('Static by default. Interactive by choice.')
    expect(overview).not.toContain('data-nib-islands')
    expect(gettingStarted).toContain('<aside class="docs-sidebar">')
    expect(gettingStarted).toMatch(/<link rel="stylesheet" href="\/assets\/[^"]+\.css" \/>/)
  }, 30_000)
})
