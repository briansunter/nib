import fs from 'node:fs/promises'
import path from 'node:path'
import type { Plugin } from 'vite'
import { pageSourceIndex } from './content'
import { fileToRoute } from './paths'
import type { PageSourceDefinition } from './types'

export function nibMarkdown(configPath = 'nib.config.ts'): Plugin {
  const configImport = JSON.stringify(path.resolve(configPath))

  return {
    name: 'nib-markdown',
    enforce: 'pre',
    async load(id) {
      const cleanId = id.split('?')[0]
      if (!cleanId.endsWith('/page.md')) return null

      const source = await fs.readFile(cleanId, 'utf8')

      return [
        `import { createElement } from 'react'`,
        `import config from ${configImport}`,
        `import { markdownToCompiledPage } from '@briansunter/nib/internal/server'`,
        `const compiled = markdownToCompiledPage(${JSON.stringify(source)}, config.markdown)`,
        `export const meta = compiled.meta`,
        `export const frontmatter = compiled.frontmatter`,
        `export const layout = compiled.layout`,
        `const content = createElement('article', {`,
        `  className: 'prose prose-invert max-w-none prose-a:text-sky-300',`,
        `  dangerouslySetInnerHTML: { __html: compiled.html }`,
        `})`,
        `export default function MarkdownPage() {`,
        `  return content`,
        `}`
      ].join('\n')
    }
  }
}

export function nibDataPages(
  configPath: string,
  definitions: ReadonlyArray<{
    extensions: readonly string[]
    match?: (file: string) => boolean
  }> | undefined,
): Plugin {
  const configImport = JSON.stringify(path.resolve(configPath))

  return {
    name: 'nib-data-pages',
    enforce: 'pre',
    async load(id) {
      const cleanId = id.split('?')[0]
      const match = cleanId.match(/\/page(\.[A-Za-z0-9]+)$/)
      if (!match || match[1] === '.md' || match[1] === '.tsx') return null
      const index = pageSourceIndex(definitions, match[1], cleanId)
      if (index === undefined) throw new Error(`No page source matches ${cleanId}`)

      const source = await fs.readFile(cleanId, 'utf8')
      return [
        `import config from ${configImport}`,
        `import { compileDataPages } from '@briansunter/nib/internal/server'`,
        `export const pages = await compileDataPages(config.pageSources[${index}], {`,
        `  file: ${JSON.stringify(cleanId)},`,
        `  source: ${JSON.stringify(source)},`,
        `  defaultPath: ${JSON.stringify(fileToRoute(cleanId))},`,
        `})`,
      ].join('\n')
    },
  }
}
