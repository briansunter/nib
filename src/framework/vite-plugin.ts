import fs from 'node:fs/promises'
import path from 'node:path'
import type { Plugin } from 'vite'
import { pageSourceIndex } from './content'
import { fileToRoute } from './paths'
import type { DerivedPagesDefinition, PageSourceDefinition, PageSourceRenderer } from './types'

const NIB_PAGE_SOURCES = 'virtual:nib/page-sources'
const RESOLVED_PAGE_SOURCES = `\0${NIB_PAGE_SOURCES}`

// Data-page source files (`.json`, `.yaml`, ...) are re-resolved to a virtual
// id before load. Vite's `canSkipImportAnalysis` hard-skips import analysis for
// any id whose extension is `.json`/`.map` (matched on the raw id string, not
// the advertised module type), so a source loaded as `projects.json?nib-page-source`
// would never have its `virtual:nib/page-sources` import rewritten and the SSR
// module runner could not resolve it. Routing these through a `\0` virtual id
// whose string never ends in `.json`/`.map` keeps the generated module in the
// normal JS import-analysis path. The real source path is URL-encoded into the
// id so load can read and compile it.
const NIB_DATA_PAGE_PREFIX = '\0nib:page-source:'

function dataPageVirtualId(cleanId: string): string {
  return `${NIB_DATA_PAGE_PREFIX}${encodeURIComponent(cleanId)}.js`
}

function parseDataPageVirtualId(id: string): string | null {
  if (!id.startsWith(NIB_DATA_PAGE_PREFIX)) return null
  const encoded = id.slice(NIB_DATA_PAGE_PREFIX.length)
  const withoutSuffix = encoded.endsWith('.js')
    ? encoded.slice(0, -'.js'.length)
    : encoded
  try {
    return decodeURIComponent(withoutSuffix)
  } catch {
    return null
  }
}

function isDataPageSourceRequest(id: string): boolean {
  const queryIndex = id.indexOf('?')
  if (queryIndex === -1) return false
  return new URLSearchParams(id.slice(queryIndex + 1)).has('nib-page-source')
}

function toAbsolutePath(cleanId: string, root: string): string {
  // Vite treats a leading `/` as project-root relative; otherwise an id that
  // is already absolute on disk passes through.
  if (cleanId === root || cleanId.startsWith(`${root}${path.sep}`)) return cleanId
  if (cleanId.startsWith('/')) return path.join(root, cleanId)
  if (!path.isAbsolute(cleanId)) return path.resolve(root, cleanId)
  return cleanId
}

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
        `import { Content as NibContent } from '@briansunter/nib'`,
        `import config from ${configImport}`,
        `import { markdownToCompiledPage } from '@briansunter/nib/internal/server'`,
        `const compiled = await markdownToCompiledPage(${JSON.stringify(source)}, config.markdown, { file: ${JSON.stringify(cleanId)} })`,
        `export const meta = compiled.meta`,
        `export const frontmatter = compiled.frontmatter`,
        `export const layout = compiled.layout`,
        `export const content = compiled.content`,
        `const defaultClassName = 'nib-markdown'`,
        `export default function MarkdownPage({ route: _route, collections: _collections, data: _data, Content = NibContent, className = defaultClassName, ...articleProps } = {}) {`,
        `  return createElement(Content, {`,
        `    ...articleProps,`,
        `    ...(Content === NibContent ? { body: compiled.content } : {}),`,
        `    as: 'article',`,
        `    className,`,
        `  })`,
        `}`
      ].join('\n')
    }
  }
}

export function nibDataPages(
  configPath: string,
  definitions: ReadonlyArray<PageSourceDefinition<any>> | undefined,
): Plugin {
  const configImport = JSON.stringify(path.resolve(configPath))
  // Captured in configResolved so resolveId can turn root-relative source ids
  // (e.g. `/src/content/projects.json`) into real filesystem paths before they
  // are folded into the virtual id.
  let projectRoot = path.dirname(path.resolve(configPath))

  return {
    name: 'nib-data-pages',
    enforce: 'pre',
    configResolved(resolvedConfig) {
      projectRoot = resolvedConfig.root
    },
    resolveId(id) {
      if (id === NIB_PAGE_SOURCES) return RESOLVED_PAGE_SOURCES
      if (!isDataPageSourceRequest(id)) return null
      const cleanId = id.split('?')[0]
      const extension = path.extname(cleanId)
      if (extension && extension !== '.md' && extension !== '.tsx') {
        if (pageSourceIndex(definitions, extension, cleanId) !== undefined) {
          return dataPageVirtualId(toAbsolutePath(cleanId, projectRoot))
        }
      }
      return null
    },
    async load(id) {
      if (id === RESOLVED_PAGE_SOURCES) {
        return [
          `import config from ${configImport}`,
          `import { configuredPageSources } from '@briansunter/nib/internal/server'`,
          `export const pageSources = configuredPageSources(config)`,
        ].join('\n')
      }
      const virtualCleanId = parseDataPageVirtualId(id)
      if (virtualCleanId === null && !isDataPageSourceRequest(id)) return null
      const cleanId = virtualCleanId ?? id.split('?')[0]
      const extension = path.extname(cleanId)
      if (!extension || extension === '.md' || extension === '.tsx') return null
      const index = pageSourceIndex(definitions, extension, cleanId)
      if (index === undefined) return null

      const source = await fs.readFile(cleanId, 'utf8')
      const renderer = rendererImport(definitions?.[index], configPath)
      const code = [
        `import { pageSources } from ${JSON.stringify(NIB_PAGE_SOURCES)}`,
        `import { compileDataPages } from '@briansunter/nib/internal/server'`,
        ...(renderer === undefined ? [] : [renderer.statement]),
        `export const pages = await compileDataPages(pageSources[${index}], {`,
        `  file: ${JSON.stringify(cleanId)},`,
        `  source: ${JSON.stringify(source)},`,
        `  defaultPath: ${JSON.stringify(cleanId.includes('/pages/') ? fileToRoute(cleanId) : '/')},`,
        `}${renderer === undefined ? '' : `, ${renderer.local}`})`,
      ].join('\n')
      // Advertise a JS module type so Vite's JSON transform does not parse the
      // generated JavaScript as a JSON literal. (Re-resolving to a virtual id
      // in resolveId is what keeps the module out of Vite's id-based import
      // analysis skip list; both are needed for `.json` sources in dev.)
      return { code, moduleType: 'js' }
    },
  }
}

const NIB_DERIVED_PAGES = 'virtual:nib/derived-pages'
const RESOLVED_DERIVED_PAGES = `\0${NIB_DERIVED_PAGES}`

export function nibDerivedPages(
  configPath: string,
  definitions: ReadonlyArray<DerivedPagesDefinition<any>> | undefined,
): Plugin {
  const configImport = JSON.stringify(path.resolve(configPath))
  const renderers = (definitions ?? []).map((definition, index) => {
    const component = definition?.component
    if (!component || typeof component === 'function') return undefined
    const renderer = component as PageSourceRenderer
    if (typeof renderer.module !== 'string') return undefined
    const source = JSON.stringify(path.resolve(path.dirname(configPath), renderer.module))
    const local = `__nibDerivedRenderer${index}`
    const statement = (renderer.exportName === undefined || renderer.exportName === 'default')
      ? `import ${local} from ${source}`
      : `import { ${renderer.exportName} as ${local} } from ${source}`
    return { local, statement }
  })
  return {
    name: 'nib-derived-pages',
    resolveId(id) { return id === NIB_DERIVED_PAGES ? RESOLVED_DERIVED_PAGES : null },
    load(id) {
      if (id !== RESOLVED_DERIVED_PAGES) return null
      const statements = renderers
        .filter((r): r is { local: string; statement: string } => r !== undefined)
        .map((r) => r.statement)
      const components = renderers.map((r) => (r ? r.local : 'undefined')).join(', ')
      return [
        `import config from ${configImport}`,
        `import { configuredDerivedPages } from '@briansunter/nib/internal/server'`,
        ...statements,
        `export const definitions = configuredDerivedPages(config)`,
        `export const components = [${components}]`,
      ].join('\n')
    },
  }
}
