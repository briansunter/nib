import path from 'node:path'
import type { Plugin } from 'vite'

export const NIB_CLIENT_ENTRY = 'virtual:nib/client-entry'
export const NIB_SERVER_ENTRY = 'virtual:nib/server-entry'

const RESOLVED_CLIENT_ENTRY = `\0${NIB_CLIENT_ENTRY}`
const RESOLVED_SERVER_ENTRY = `\0${NIB_SERVER_ENTRY}`

export function nibProject(configPath: string): Plugin {
  const configImport = JSON.stringify(path.resolve(configPath))

  return {
    name: 'nib-project',
    resolveId(id) {
      if (id === NIB_CLIENT_ENTRY) return RESOLVED_CLIENT_ENTRY
      if (id === NIB_SERVER_ENTRY) return RESOLVED_SERVER_ENTRY
      return null
    },
    load(id) {
      if (id === RESOLVED_CLIENT_ENTRY) {
        return [
          `import { startIslandRuntime } from '@briansunter/nib/internal/client'`,
          `const modules = import.meta.glob('/src/islands/**/*.tsx')`,
          `startIslandRuntime(modules)`,
        ].join('\n')
      }
      if (id !== RESOLVED_SERVER_ENTRY) return null

      return [
        `import { createElement } from 'react'`,
        `import config from ${configImport}`,
        `import {`,
        `  DefaultSiteShell,`,
        `  createRoutes,`,
        `  getRoute,`,
        `  renderHead,`,
        `  renderReactPage,`,
        `  stripBasePath,`,
        `  validateIslandModules,`,
        `} from '@briansunter/nib/internal/server'`,
        `const pages = import.meta.glob(['/src/pages/**/page.tsx', '/src/pages/**/page.md'], { eager: true })`,
        `const islandModules = import.meta.glob('/src/islands/**/*.tsx', { eager: true })`,
        `validateIslandModules(islandModules)`,
        `const routes = createRoutes(pages, config.site)`,
        `const Shell = config.shell ?? DefaultSiteShell`,
        `export const paths = [...routes.values()]`,
        `  .filter((route) => route.status === 200)`,
        `  .map((route) => route.path)`,
        `export function render(url) {`,
        `  const route = getRoute(routes, stripBasePath(url, import.meta.env.BASE_URL))`,
        `  const tree = createElement(`,
        `    Shell,`,
        `    { route, site: config.site },`,
        `    createElement(route.component),`,
        `  )`,
        `  const page = renderReactPage(tree)`,
        `  return {`,
        `    status: route.status,`,
        `    head: renderHead(route.meta),`,
        `    html: page.html,`,
        `    islands: page.islands,`,
        `  }`,
        `}`,
      ].join('\n')
    },
  }
}
