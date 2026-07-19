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
      status: 200,
      head: '<title>Site</title>\n    <meta name="description" content="Description" />',
      html: '<header><a href="/">Site</a></header><main><h1>Home</h1></main>',
      islands: [],
    })
  })
})
