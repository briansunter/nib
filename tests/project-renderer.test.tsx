import { describe, expect, it } from 'vitest'
import { createProjectRenderer } from '../src/framework/project-renderer'

const Page = () => <h1>Home</h1>

describe('project renderer', () => {
  it('owns route setup and document data rendering behind one interface', async () => {
    const renderer = await createProjectRenderer({
      config: { site: { title: 'Site', description: 'Description' } },
      root: process.cwd(),
      base: '/',
      pages: { '/src/pages/page.tsx': { default: Page } },
      islandModules: {},
    })

    expect(renderer.paths).toEqual(['/'])
    expect(renderer.render('/')).toMatchObject({
      kind: 'page',
      page: {
        status: 200,
        head: '<title>Site</title>\n    <meta name="description" content="Description" />',
        html: '<header><a href="/">Site</a></header><main><h1>Home</h1></main>',
        islands: [],
      },
    })
  })

  it('enforces trailing slashes and configured redirects in development rendering', async () => {
    const renderer = await createProjectRenderer({
      config: {
        site: { title: 'Site' },
        trailingSlash: 'never',
        redirects: {
          '/old': { destination: '/about/', status: 302 },
        },
      },
      root: process.cwd(),
      base: '/base/',
      pages: { '/src/pages/about/page.tsx': { default: Page } },
      islandModules: {},
      command: 'serve',
    })

    expect(renderer.render('/base/about/')).toEqual({
      kind: 'redirect',
      status: 301,
      destination: '/base/about',
    })
    expect(renderer.render('/base/old')).toEqual({
      kind: 'redirect',
      status: 302,
      destination: '/base/about',
    })
  })
})
