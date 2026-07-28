import { readFile, readdir, rm } from 'node:fs/promises'
import path from 'node:path'
import { close, createIndex } from 'pagefind'
import { definePlugin } from '@briansunter/nib/plugin'

function routeFromFile(clientDirectory: string, file: string): string {
  const relative = path.relative(clientDirectory, file).replaceAll(path.sep, '/')
  if (relative === 'index.html') return '/'
  if (relative.endsWith('/index.html')) {
    return `/${relative.slice(0, -'/index.html'.length)}`
  }
  return `/${relative}`
}

async function collectIndexablePages(
  clientDirectory: string,
  directory: string,
  outputDirectory: string,
  pages: Array<{ url: string; content: string }>,
): Promise<void> {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name)
    if (entry.isDirectory()) {
      if (file !== outputDirectory) {
        await collectIndexablePages(clientDirectory, file, outputDirectory, pages)
      }
      continue
    }
    if (!entry.isFile()) continue

    const isIndex = entry.name === 'index.html'
    const isExtensionless = path.extname(entry.name) === ''
    if (!isIndex && !isExtensionless) continue
    const content = await readFile(file, 'utf8')
    if (!/<(?:!doctype\s+html|html)\b/i.test(content.slice(0, 512))) continue
    if (!content.includes('data-pagefind-body')) continue
    pages.push({ url: routeFromFile(clientDirectory, file), content })
  }
}

/** App-owned output adapter: Pagefind is the replica's sole search index. */
export function pagefindSearch() {
  return definePlugin({
    name: 'personal-site-pagefind',
    renderer() {
      return {
        async finalize({ clientDirectory }) {
          const outputDirectory = path.join(clientDirectory, 'pagefind')
          await rm(outputDirectory, { recursive: true, force: true })
          const pages: Array<{ url: string; content: string }> = []
          await collectIndexablePages(
            clientDirectory,
            clientDirectory,
            outputDirectory,
            pages,
          )
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
            const written = await created.index.writeFiles({
              outputPath: outputDirectory,
            })
            if (written.errors.length > 0) {
              throw new Error(`Unable to write Pagefind index: ${written.errors.join('; ')}`)
            }
          } finally {
            await close()
          }
          console.log(`Pagefind indexed ${pages.length} pages.`)
        },
      }
    },
  })
}
