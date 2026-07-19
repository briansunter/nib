import path from 'node:path'
import type { Plugin } from 'vite'
import type { NibCommand } from './plugin'

export const NIB_CLIENT_ENTRY = 'virtual:nib/client-entry'
export const NIB_SERVER_ENTRY = 'virtual:nib/server-entry'

const RESOLVED_CLIENT_ENTRY = `\0${NIB_CLIENT_ENTRY}`
const RESOLVED_SERVER_ENTRY = `\0${NIB_SERVER_ENTRY}`

export function nibProject(
  configPath: string,
  root = path.dirname(configPath),
  pageExtensions: readonly string[] = [],
  command: NibCommand = 'build',
): Plugin {
  const configImport = JSON.stringify(path.resolve(configPath))
  const projectRoot = JSON.stringify(path.resolve(root))
  const pagePatterns = [
    '/src/pages/**/page.tsx',
    '/src/pages/**/page.md',
    ...pageExtensions.map((extension) => `/src/pages/**/page${extension}`),
  ]

  return {
    name: 'nib-project',
    resolveId(id) {
      if (id === NIB_CLIENT_ENTRY) return RESOLVED_CLIENT_ENTRY
      if (id === NIB_SERVER_ENTRY) return RESOLVED_SERVER_ENTRY
      return null
    },
    handleHotUpdate(context) {
      const serverEntry = context.server.moduleGraph.getModuleById(RESOLVED_SERVER_ENTRY)
      if (!serverEntry) return
      context.server.moduleGraph.invalidateModule(serverEntry)
      return [...new Set([...context.modules, serverEntry])]
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
        `import config from ${configImport}`,
        `import {`,
        `  createProjectRenderer,`,
        `} from '@briansunter/nib/internal/server'`,
        `const pages = import.meta.glob(${JSON.stringify(pagePatterns)}, { eager: true })`,
        `const folderLayouts = import.meta.glob('/src/pages/**/layout.tsx', { eager: true })`,
        `const namedLayouts = import.meta.glob('/src/layouts/*.tsx', { eager: true })`,
        `const islandModules = import.meta.glob('/src/islands/**/*.tsx', { eager: true })`,
        `const renderer = await createProjectRenderer({`,
        `  config,`,
        `  root: ${projectRoot},`,
        `  base: import.meta.env.BASE_URL,`,
        `  command: ${JSON.stringify(command)},`,
        `  pages,`,
        `  folderLayouts,`,
        `  namedLayouts,`,
        `  islandModules,`,
        `})`,
        `export const paths = renderer.paths`,
        `export const render = renderer.render`,
        `export const finalize = renderer.finalize`,
      ].join('\n')
    },
  }
}
