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

    const home = await fs.readFile(path.join(output, 'client/index.html'), 'utf8')
    const overview = await fs.readFile(path.join(output, 'client/docs/index.html'), 'utf8')
    const mark = await fs.readFile(path.join(output, 'client/nib-mark.svg'), 'utf8')
    const wordmark = await fs.readFile(path.join(output, 'client/nib-wordmark.svg'), 'utf8')
    const gettingStarted = await fs.readFile(
      path.join(output, 'client/docs/getting-started/index.html'),
      'utf8',
    )
    expect(overview).toMatch(/<link rel="stylesheet" href="[^"]*\/assets\/[^"]+\.css" \/>/)
    expect(mark).toContain('<svg')
    expect(wordmark).toContain('<svg')
    expect(overview).toContain('<a class="skip-link" href="#content">Skip to content</a>')
    expect(home).toContain('<details class="mobile-nav">')
    expect(home).toContain('nib-mark.svg')
    expect(home).toContain('href="https://github.com/briansunter/nib"')
    expect(home).toContain('GitHub repository (opens in a new tab)')
    expect(home).toContain('framework docs')
    expect(home).toContain('<nav aria-label="Mobile documentation" class="mobile-nav__documentation">')
    expect(home).toContain('>Get started <span aria-hidden="true">→</span></a>')
    expect(home).toContain('React pages.')
    expect(home).toContain('Static output.')
    expect(home).toContain('How Nib turns a route into HTML')
    expect(home).toContain('npx @briansunter/nib init my-site')
    expect(home).toContain('src/pages/notes/page.md')
    expect(home).toContain('/notes/index.html')
    expect(home).toContain('Complete HTML · no client runtime')
    expect(home).toContain('Use the lightest tool for each page.')
    expect(home).toContain('React pages')
    expect(home).toContain('Markdown')
    expect(home).toContain('Data pages')
    expect(home).toContain('React islands')
    expect(home).toContain('No server required.')
    expect(home).toContain('Deploy a Nib site')
    expect(home).not.toContain('data-nib-islands')
    expect(overview).toContain('<aside class="docs-sidebar">')
    expect(overview).toContain('<details class="docs-menu" open="">')
    expect(overview).toContain('START HERE')
    expect(overview).toContain('BUILD')
    expect(overview).toContain('SHIP')
    for (const href of [
      '/docs/',
      '/docs/getting-started/',
      '/docs/pages-and-routes/',
      '/docs/markdown-and-layouts/',
      '/docs/data-pages-and-collections/',
      '/docs/react-islands/',
      '/docs/github-pages/',
      '/docs/releases/',
    ]) {
      expect(overview).toMatch(new RegExp(`href="[^"]*${href}"`))
      expect(home).toMatch(new RegExp(`href="[^"]*${href}"`))
    }
    expect(overview).toContain('Static by default. Interactive by choice.')
    expect(overview).toContain('React, Markdown, and data pages, static by default.')
    expect(overview).toContain('Read the docs')
    expect(overview).not.toContain('data-nib-islands')
    expect(gettingStarted).toContain('<aside class="docs-sidebar">')
    expect(gettingStarted).toMatch(/<link rel="stylesheet" href="[^"]*\/assets\/[^"]+\.css" \/>/)
    const dataPages = await fs.readFile(
      path.join(output, 'client/docs/data-pages-and-collections/index.html'),
      'utf8',
    )
    expect(dataPages).toContain('<h1>Data pages and collections</h1>')
  }, 30_000)
})
