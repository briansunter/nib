import { readFile, readdir, rm } from 'node:fs/promises'
import path from 'node:path'
import { close, createIndex } from 'pagefind'

const root = process.cwd()
const clientDir = path.join(root, 'dist', 'client')
const outputDir = path.join(clientDir, 'pagefind')

function routeFromFile(file) {
  const relative = path.relative(clientDir, file).replaceAll(path.sep, '/')
  if (relative === 'index.html') return '/'
  if (relative.endsWith('/index.html')) return `/${relative.slice(0, -'/index.html'.length)}`
  return `/${relative}`
}

async function collectIndexablePages(directory, pages) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name)
    if (entry.isDirectory()) {
      if (file !== outputDir) await collectIndexablePages(file, pages)
      continue
    }
    if (!entry.isFile()) continue

    const isIndex = entry.name === 'index.html'
    const isExtensionless = path.extname(entry.name) === ''
    if (!isIndex && !isExtensionless) continue

    const content = await readFile(file, 'utf8')
    if (!/<(?:!doctype\s+html|html)\b/i.test(content.slice(0, 512))) continue
    if (!content.includes('data-pagefind-body')) continue

    pages.push({
      url: routeFromFile(file),
      content,
    })
  }
}

await rm(outputDir, { recursive: true, force: true })

const pages = []
await collectIndexablePages(clientDir, pages)
pages.sort((left, right) => left.url.localeCompare(right.url))

try {
  const created = await createIndex()
  if (!created.index || created.errors.length > 0) {
    throw new Error(`Unable to create Pagefind index: ${created.errors.join('; ')}`)
  }

  for (const page of pages) {
    const result = await created.index.addHTMLFile(page)
    if (result.errors.length > 0) {
      throw new Error(`Unable to index ${page.url}: ${result.errors.join('; ')}`)
    }
  }

  const written = await created.index.writeFiles({ outputPath: outputDir })
  if (written.errors.length > 0) {
    throw new Error(`Unable to write Pagefind index: ${written.errors.join('; ')}`)
  }

  console.log(`Pagefind indexed ${pages.length} pages.`)
} finally {
  await close()
}
