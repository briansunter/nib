import fs from 'node:fs/promises'
import path from 'node:path'
import type { Plugin } from 'vite'
import { pageSourceIndex } from './content'
import { fileToRoute } from './paths'
import type { NibVitePluginContext } from './plugin'
import type { PageSourceDefinition, PageSourceRenderer } from './types'

const NIB_PAGE_SOURCES = 'virtual:nib/page-sources'
const RESOLVED_PAGE_SOURCES = `\0${NIB_PAGE_SOURCES}`

function rendererImport(
  definition: PageSourceDefinition<any> | undefined,
  configPath: string,
): { statement: string; local: string } | undefined {
  if (!definition || typeof definition.component === 'function') return undefined
  const renderer = definition.component as PageSourceRenderer
  if (typeof renderer.module !== 'string') return undefined
  const source = JSON.stringify(path.resolve(path.dirname(configPath), renderer.module))
  const local = '__nibPageRenderer'
  if (renderer.exportName === undefined || renderer.exportName === 'default') {
    return { statement: `import ${local} from ${source}`, local }
  }
  return { statement: `import { ${renderer.exportName} as ${local} } from ${source}`, local }
}

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
  definitions: ReadonlyArray<PageSourceDefinition<any>> | undefined,
  context?: NibVitePluginContext,
): Plugin {
  const configImport = JSON.stringify(path.resolve(configPath))

  return {
    name: 'nib-data-pages',
    enforce: 'pre',
    resolveId(id) {
      if (id === NIB_PAGE_SOURCES) return RESOLVED_PAGE_SOURCES
      return null
    },
    async load(id) {
      if (id === RESOLVED_PAGE_SOURCES) {
        const setupContext = context ?? {
          command: 'serve',
          mode: 'development',
          target: 'development',
          root: path.dirname(path.resolve(configPath)),
          base: '/',
          configPath: path.resolve(configPath),
        }
        return [
          `import config from ${configImport}`,
          `import { resolvePluginSetupContributions } from '@briansunter/nib/internal/server'`,
          `const setup = await resolvePluginSetupContributions(`,
          `  config.plugins ?? [],`,
          `  Object.freeze(${JSON.stringify(setupContext)}),`,
          `)`,
          `export const pageSources = [`,
          `  ...(config.pageSources ?? []),`,
          `  ...(setup.pageSources ?? []),`,
          `]`,
        ].join('\n')
      }
      const cleanId = id.split('?')[0]
      const match = cleanId.match(/\/page(\.[A-Za-z0-9]+)$/)
      if (!match || match[1] === '.md' || match[1] === '.tsx') return null
      const index = pageSourceIndex(definitions, match[1], cleanId)
      if (index === undefined) throw new Error(`No page source matches ${cleanId}`)

      const source = await fs.readFile(cleanId, 'utf8')
      const renderer = rendererImport(definitions?.[index], configPath)
      return [
        `import { pageSources } from ${JSON.stringify(NIB_PAGE_SOURCES)}`,
        `import { compileDataPages } from '@briansunter/nib/internal/server'`,
        ...(renderer === undefined ? [] : [renderer.statement]),
        `export const pages = await compileDataPages(pageSources[${index}], {`,
        `  file: ${JSON.stringify(cleanId)},`,
        `  source: ${JSON.stringify(source)},`,
        `  defaultPath: ${JSON.stringify(fileToRoute(cleanId))},`,
        `}${renderer === undefined ? '' : `, ${renderer.local}`})`,
      ].join('\n')
    },
  }
}
