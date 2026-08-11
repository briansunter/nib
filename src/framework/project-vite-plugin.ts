import path from 'node:path'
import type { Plugin } from 'vite'
import { BEHAVIOR_MODULE_GLOB } from './behavior-paths'
import type { NibClientEntry, NibCommand } from './plugin'

export const NIB_BEHAVIOR_ENTRY = 'virtual:nib/behavior-entry'
export const NIB_CLIENT_BOOTSTRAP_ENTRY = 'virtual:nib/client-bootstrap-entry'
export const NIB_EMPTY_CLIENT_ENTRY = 'virtual:nib/empty-client-entry'
export const NIB_SERVER_ENTRY = 'virtual:nib/server-entry'

const RESOLVED_BEHAVIOR_ENTRY = `\0${NIB_BEHAVIOR_ENTRY}`
const RESOLVED_CLIENT_BOOTSTRAP_ENTRY = `\0${NIB_CLIENT_BOOTSTRAP_ENTRY}`
const RESOLVED_EMPTY_CLIENT_ENTRY = `\0${NIB_EMPTY_CLIENT_ENTRY}`
const RESOLVED_SERVER_ENTRY = `\0${NIB_SERVER_ENTRY}`

export function nibProject(
  configPath: string,
  root = path.dirname(configPath),
  pageExtensions: readonly string[] = [],
  command: NibCommand = 'build',
  pageSourcePatterns: readonly string[] = [],
  clientEntries: readonly NibClientEntry[] = [],
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
      if (id === NIB_BEHAVIOR_ENTRY) return RESOLVED_BEHAVIOR_ENTRY
      if (id === NIB_CLIENT_BOOTSTRAP_ENTRY && clientEntries.length > 0) {
        return RESOLVED_CLIENT_BOOTSTRAP_ENTRY
      }
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
      if (id === RESOLVED_BEHAVIOR_ENTRY) {
        return [
          `import { createBehaviorRuntime, registerClientRuntime } from '@briansunter/nib/internal/client'`,
          `const modules = import.meta.glob(${JSON.stringify(BEHAVIOR_MODULE_GLOB)})`,
          `const runtime = createBehaviorRuntime(modules)`,
          `const unregisterRuntime = registerClientRuntime(runtime)`,
          `runtime.mount(document)`,
          `if (import.meta.hot) import.meta.hot.dispose(() => {`,
          `  unregisterRuntime()`,
          `  runtime.destroy()`,
          `})`,
        ].join('\n')
      }
      if (id === RESOLVED_CLIENT_BOOTSTRAP_ENTRY) {
        return [
          ...clientEntries.map((entry, index) => (
            `import { ${entry.initializer} as __nibClientInitializer${index} } from ${JSON.stringify(entry.module)}`
          )),
          `const __nibClientBootstrapController = new AbortController()`,
          `const __nibClientBootstrapSignal = __nibClientBootstrapController.signal`,
          `try {`,
          ...clientEntries.map((_, index) => (
            `  __nibClientInitializer${index}(__nibClientBootstrapSignal)`
          )),
          `} catch (error) {`,
          `  __nibClientBootstrapController.abort(error)`,
          `  throw error`,
          `}`,
          `if (import.meta.hot) import.meta.hot.dispose(() => {`,
          `  __nibClientBootstrapController.abort()`,
          `})`,
        ].join('\n')
      }
      if (id === RESOLVED_EMPTY_CLIENT_ENTRY) return 'export {}'
      if (id !== RESOLVED_SERVER_ENTRY) return null

      return [
        `import config from ${configImport}`,
        `import {`,
        `  createProjectRenderer,`,
        `} from '@briansunter/nib/internal/server'`,
        `import { definitions as __nibDerivedDefinitions, components as __nibDerivedComponents } from 'virtual:nib/derived-pages'`,
        // Keep source modules behind a private query so Vite's built-in JSON
        // loader does not parse a page-source adapter's generated JS as JSON.
        `const pages = import.meta.glob(${JSON.stringify(pagePatterns)}, { eager: true, query: '?nib-page-source' })`,
        `const folderLayouts = import.meta.glob('/src/pages/**/layout.tsx', { eager: true })`,
        `const namedLayouts = import.meta.glob('/src/layouts/*.tsx', { eager: true })`,
        `const behaviorClientFiles = Object.keys(import.meta.glob(${JSON.stringify(BEHAVIOR_MODULE_GLOB)}))`,
        `const renderer = await createProjectRenderer({`,
        `  config,`,
        `  root: ${projectRoot},`,
        `  base: import.meta.env.BASE_URL,`,
        `  command: ${JSON.stringify(command)},`,
        `  pages,`,
        `  folderLayouts,`,
        `  namedLayouts,`,
        `  behaviorClientFiles,`,
        `  derivedPages: { definitions: __nibDerivedDefinitions, components: __nibDerivedComponents },`,
        `})`,
        `export const paths = renderer.paths`,
        `export const render = renderer.render`,
        `export const finalize = renderer.finalize`,
      ].join('\n')
    },
  }
}
