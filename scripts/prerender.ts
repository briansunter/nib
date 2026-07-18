import fs from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { renderDocument } from '../src/framework/document'
import type { RenderedPage } from '../src/framework/types'

const root = path.resolve(import.meta.dirname, '..')
const clientDir = path.join(root, 'dist/client')
const serverEntry = path.join(root, 'dist/server/entry-server.js')
const template = await fs.readFile(path.join(clientDir, 'index.html'), 'utf8')
const { paths, render } = await import(pathToFileURL(serverEntry).href) as {
  paths: string[]
  render: (url: string) => RenderedPage
}

for (const routePath of paths) {
  const file = path.join(clientDir, routePath === '/' ? 'index.html' : `${routePath.slice(1)}/index.html`)
  await fs.mkdir(path.dirname(file), { recursive: true })
  await fs.writeFile(file, renderDocument(template, render(routePath)))
  console.log(`prerendered ${routePath}`)
}

await fs.writeFile(path.join(clientDir, '404.html'), renderDocument(template, render('/404')))
