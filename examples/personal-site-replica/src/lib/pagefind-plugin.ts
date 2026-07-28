import { readFile, rm } from 'node:fs/promises'
import path from 'node:path'
import { close, createIndex } from 'pagefind'
import { definePlugin } from '@briansunter/nib/plugin'

async function collectIndexablePages(
  clientDirectory: string,
  routes: readonly {
    readonly kind: string
    readonly path: string
    readonly artifact: string
    readonly contentType: string
  }[],
  pages: Array<{ url: string; content: string }>,
): Promise<void> {
  for (const route of routes) {
    if (route.kind !== 'page' || !route.contentType.startsWith('text/html')) continue
    const file = path.resolve(clientDirectory, route.artifact)
    const relative = path.relative(clientDirectory, file)
    if (relative.startsWith('..') || path.isAbsolute(relative)) {
      throw new Error(`Pagefind artifact escapes the client directory: ${route.artifact}`)
    }
    const content = await readFile(file, 'utf8')
    if (!content.includes('data-pagefind-body')) continue
    pages.push({ url: route.path, content })
  }
}

/** App-owned output adapter: Pagefind is the replica's sole search index. */
export function pagefindSearch() {
  return definePlugin({
    name: 'personal-site-pagefind',
    renderer() {
      return {
        async finalize({ clientDirectory, publication }) {
          const outputDirectory = path.join(clientDirectory, 'pagefind')
          await rm(outputDirectory, { recursive: true, force: true })
          const pages: Array<{ url: string; content: string }> = []
          await collectIndexablePages(
            clientDirectory,
            publication.routes,
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
