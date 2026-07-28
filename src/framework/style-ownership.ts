import fs from 'node:fs'
import path from 'node:path'
import type { Plugin } from 'vite'
import type { NibViteTarget } from './plugin'
import { cleanModuleId, moduleTarget } from './module-target'

function sourceRoot(root: string): string {
  const resolved = path.resolve(root, 'src')
  const canonical = (() => {
    try {
      return fs.realpathSync.native(resolved)
    } catch {
      return resolved
    }
  })()
  return `${canonical.replaceAll('\\', '/')}/`
}

function islandEntry(file: string): boolean {
  return /\/src\/islands\/.*\.tsx$/.test(file)
}

function behaviorEntry(file: string): boolean {
  return /\/src\/behaviors\/.*\.client\.(?:ts|tsx)$/.test(file)
}

function applicationModule(applicationRoot: string, id: string): boolean {
  const file = cleanModuleId(id)
  return file.startsWith(applicationRoot)
    && !islandEntry(file)
    && !behaviorEntry(file)
    && file !== `${applicationRoot}style.css`
    && moduleTarget(file) !== 'client'
}

function clientOwnedModule(applicationRoot: string, id: string): boolean {
  const file = cleanModuleId(id)
  return id.includes('virtual:nib/enhancement-entry')
    || (
      file.startsWith(applicationRoot)
      && (
        islandEntry(file)
        || behaviorEntry(file)
        || moduleTarget(file) === 'client'
      )
    )
}

/**
 * Rejects styles that the server can see but Nib's deployed client entries
 * cannot. Route-scoped CSS is deliberately not inferred in this contract.
 */
export function pageStyleOwnershipGuard(
  root: string,
  target: NibViteTarget,
): Plugin {
  const applicationRoot = sourceRoot(root)
  const clientOwned = new Set<string>()
  return {
    name: 'nib-page-style-ownership',
    enforce: 'pre',
    async resolveId(source, importer) {
      if (target === 'client' || importer === undefined) return null
      const resolved = await this.resolve(source, importer, { skipSelf: true })
      const resolvedId = resolved?.id ?? source
      const importerIsClientOwned = clientOwned.has(cleanModuleId(importer))
        || clientOwnedModule(applicationRoot, importer)
      if (importerIsClientOwned) {
        if (!cleanModuleId(resolvedId).endsWith('.css')) {
          clientOwned.add(cleanModuleId(resolvedId))
        }
        return null
      }
      if (!applicationModule(applicationRoot, importer)) return null
      if (!cleanModuleId(resolvedId).endsWith('.css')) return null
      throw new Error([
        `Nib cannot deploy stylesheet ${source} imported by ${cleanModuleId(importer)}.`,
        'Move the import to src/style.css, an island or .client behavior module,',
        'or a plugin-owned client entry. Route-scoped page CSS is not supported.',
      ].join(' '))
    },
  }
}
