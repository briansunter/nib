import fs from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { outputPath } from '../src/framework/paths'
import type { RenderedPage } from '../src/framework/types'

const root = path.resolve(import.meta.dirname, '..')
const clientDir = path.join(root, 'dist/client')
const serverEntry = path.join(root, 'dist/server/entry-server.js')
const template = await fs.readFile(path.join(clientDir, 'index.html'), 'utf8')
const { paths, render } = await import(pathToFileURL(serverEntry).href) as {
  paths: string[]
  render: (url: string) => RenderedPage
}

function document(page: RenderedPage) {
  return template.replace('<!--head-outlet-->', page.head).replace('<!--ssr-outlet-->', page.html)
}

for (const routePath of paths) {
  const file = path.join(clientDir, outputPath(routePath))
  await fs.mkdir(path.dirname(file), { recursive: true })
  await fs.writeFile(file, document(render(routePath)))
  console.log(`prerendered ${routePath}`)
}

await fs.writeFile(path.join(clientDir, '404.html'), document(render('/404')))
