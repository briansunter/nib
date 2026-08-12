import path from 'node:path'
import type { Plugin } from 'vite'
import { ENHANCEMENT_MODULE_GLOB } from './enhancement-paths'
import { ISLAND_MODULE_GLOB } from './island-paths'
import type { NibCommand } from './plugin'

export const NIB_ENHANCEMENT_ENTRY = 'virtual:nib/enhancement-entry'
export const NIB_ISLAND_ENTRY = 'virtual:nib/island-entry'
export const NIB_APP_CLIENT_ENTRY = 'virtual:nib/app-client-entry'
export const NIB_EMPTY_CLIENT_ENTRY = 'virtual:nib/empty-client-entry'
export const NIB_SERVER_ENTRY = 'virtual:nib/server-entry'

const RESOLVED_ENHANCEMENT_ENTRY = `\0${NIB_ENHANCEMENT_ENTRY}`
const RESOLVED_ISLAND_ENTRY = `\0${NIB_ISLAND_ENTRY}`
const RESOLVED_APP_CLIENT_ENTRY = `\0${NIB_APP_CLIENT_ENTRY}`
const RESOLVED_EMPTY_CLIENT_ENTRY = `\0${NIB_EMPTY_CLIENT_ENTRY}`
const RESOLVED_SERVER_ENTRY = `\0${NIB_SERVER_ENTRY}`

export function nibProject(
  configPath: string,
  root = path.dirname(configPath),
  pageExtensions: readonly string[] = [],
  command: NibCommand = 'build',
  pageSourcePatterns: readonly string[] = [],
  hasAppClient = false,
): Plugin {
  const configImport = JSON.stringify(path.resolve(configPath))
  const projectRoot = JSON.stringify(path.resolve(root))
  const pagePatterns = [
    '/src/pages/**/page.tsx',
    '/src/pages/**/page.md',
    ...pageExtensions.map((extension) => `/src/pages/**/page${extension}`),
    ...pageSourcePatterns,
  ]

  return {
    name: 'nib-project',
    resolveId(id) {
      if (id === NIB_ENHANCEMENT_ENTRY) return RESOLVED_ENHANCEMENT_ENTRY
      if (id === NIB_ISLAND_ENTRY) return RESOLVED_ISLAND_ENTRY
      if (id === NIB_APP_CLIENT_ENTRY && hasAppClient) return RESOLVED_APP_CLIENT_ENTRY
      if (id === NIB_EMPTY_CLIENT_ENTRY) return RESOLVED_EMPTY_CLIENT_ENTRY
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
      if (id === RESOLVED_ENHANCEMENT_ENTRY) {
        return [
          `import { createEnhancementRuntime } from '@briansunter/nib/internal/enhancements'`,
          `const modules = import.meta.glob(${JSON.stringify(ENHANCEMENT_MODULE_GLOB)})`,
          `const runtime = createEnhancementRuntime(modules)`,
          `runtime.mount(document)`,
          `if (import.meta.hot) import.meta.hot.dispose(() => runtime.destroy())`,
        ].join('\n')
      }
      if (id === RESOLVED_ISLAND_ENTRY) {
        return [
          `import { createIslandRuntime } from '@briansunter/nib/internal/islands'`,
          `const modules = import.meta.glob(${JSON.stringify(ISLAND_MODULE_GLOB)})`,
          `const runtime = createIslandRuntime(modules)`,
          `runtime.mount(document)`,
          `if (import.meta.hot) import.meta.hot.dispose(() => runtime.destroy())`,
        ].join('\n')
      }
      if (id === RESOLVED_APP_CLIENT_ENTRY) {
        return [
          `import initialize from '/src/client.ts'`,
          `if (typeof initialize !== 'function') {`,
          `  throw new Error('src/client.ts must default-export a client initializer function')`,
          `}`,
          `const controller = new AbortController()`,
          `try {`,
          `  const initialized = initialize(controller.signal)`,
          `  if (initialized && typeof initialized.then === 'function') {`,
          `    void initialized.catch((error) => {`,
          `      if (controller.signal.aborted) return`,
          `      controller.abort(error)`,
          `      setTimeout(() => { throw error })`,
          `    })`,
          `  }`,
          `} catch (error) {`,
          `  controller.abort(error)`,
          `  throw error`,
          `}`,
          `if (import.meta.hot) import.meta.hot.dispose(() => controller.abort())`,
        ].join('\n')
      }
      if (id === RESOLVED_EMPTY_CLIENT_ENTRY) return 'export {}'
      if (id !== RESOLVED_SERVER_ENTRY) return null

      return [
        `import config from ${configImport}`,
        `import { createProjectRenderer } from '@briansunter/nib/internal/server'`,
        `import { definitions as __nibDerivedDefinitions, components as __nibDerivedComponents } from 'virtual:nib/derived-pages'`,
        // Keep source modules behind a private query so Vite's built-in JSON
        // loader does not parse a page-source adapter's generated JS as JSON.
        `const pages = import.meta.glob(${JSON.stringify(pagePatterns)}, { eager: true, query: '?nib-page-source' })`,
        `const folderLayouts = import.meta.glob('/src/pages/**/layout.tsx', { eager: true })`,
        `const namedLayouts = import.meta.glob('/src/layouts/*.tsx', { eager: true })`,
        `const islandModules = import.meta.glob(${JSON.stringify(ISLAND_MODULE_GLOB)}, { eager: true })`,
        `const enhancementClientFiles = Object.keys(import.meta.glob(${JSON.stringify(ENHANCEMENT_MODULE_GLOB)}))`,
        `const renderer = await createProjectRenderer({`,
        `  config,`,
        `  root: ${projectRoot},`,
        `  base: import.meta.env.BASE_URL,`,
        `  command: ${JSON.stringify(command)},`,
        `  pages,`,
        `  folderLayouts,`,
        `  namedLayouts,`,
        `  islandModules,`,
        `  enhancementClientFiles,`,
        `  derivedPages: { definitions: __nibDerivedDefinitions, components: __nibDerivedComponents },`,
        `})`,
        `export const paths = renderer.paths`,
        `export const render = renderer.render`,
        `export const finalize = renderer.finalize`,
      ].join('\n')
    },
  }
}
