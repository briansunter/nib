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

function enhancementEntry(file: string): boolean {
  return /\/src\/enhancements\/.+\/index\.client\.(?:js|ts)$/.test(file)
}

function islandEntry(file: string): boolean {
  return /\/src\/islands\/.+\.tsx$/.test(file)
}

function applicationModule(applicationRoot: string, id: string): boolean {
  const file = cleanModuleId(id)
  return file.startsWith(applicationRoot)
    && !enhancementEntry(file)
    && !islandEntry(file)
    && file !== `${applicationRoot}client.ts`
    && file !== `${applicationRoot}style.css`
    && moduleTarget(file) !== 'client'
}

function clientOwnedModule(applicationRoot: string, id: string): boolean {
  const file = cleanModuleId(id)
  return id.includes('virtual:nib/app-client-entry')
    || id.includes('virtual:nib/enhancement-entry')
    || id.includes('virtual:nib/island-entry')
    || (
      file.startsWith(applicationRoot)
      && (
        enhancementEntry(file)
        || islandEntry(file)
        || file === `${applicationRoot}client.ts`
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
  const CLIENT = 1
  const SERVER = 2
  const ownership = new Map<string, number>()
  const dependencies = new Map<string, Set<string>>()
  const styleImports = new Map<string, { source: string; importer: string }>()

  const ownershipError = (source: string, importer: string) => new Error([
    `Nib cannot deploy stylesheet ${source} imported by ${cleanModuleId(importer)}.`,
    'Move the import to src/style.css, an enhancement index.client module,',
    'an island module, or src/client.ts. Route-scoped page CSS is not supported.',
  ].join(' '))

  const directOwnership = (id: string): number => {
    if (clientOwnedModule(applicationRoot, id)) return CLIENT
    if (applicationModule(applicationRoot, id)) return SERVER
    return 0
  }

  const markOwnership = (
    id: string,
    added: number,
    visiting = new Set<string>(),
  ): void => {
    const moduleId = cleanModuleId(id)
    if (visiting.has(moduleId)) return
    const previous = ownership.get(moduleId) ?? 0
    const next = previous | added
    if (next === previous) return
    ownership.set(moduleId, next)
    if ((next & SERVER) !== 0) {
      const importedStyle = styleImports.get(moduleId)
      if (importedStyle !== undefined) {
        throw ownershipError(importedStyle.source, importedStyle.importer)
      }
    }
    visiting.add(moduleId)
    for (const dependency of dependencies.get(moduleId) ?? []) {
      markOwnership(
        dependency,
        clientOwnedModule(applicationRoot, dependency) ? CLIENT : added,
        visiting,
      )
    }
    visiting.delete(moduleId)
  }

  const moduleOwnership = (id: string): number => {
    const moduleId = cleanModuleId(id)
    const known = ownership.get(moduleId)
    if (known !== undefined) return known
    const direct = directOwnership(id)
    if (direct !== 0) markOwnership(moduleId, direct)
    return direct
  }

  return {
    name: 'nib-page-style-ownership',
    enforce: 'pre',
    async resolveId(source, importer) {
      if (target === 'client' || importer === undefined) return null
      const resolved = await this.resolve(source, importer, { skipSelf: true })
      const resolvedId = resolved?.id ?? source
      const importerId = cleanModuleId(importer)
      const importedId = cleanModuleId(resolvedId)
      const importerOwnership = moduleOwnership(importer)
      if (importedId.endsWith('.css')) {
        styleImports.set(importerId, { source, importer })
        if ((importerOwnership & SERVER) !== 0) {
          throw ownershipError(source, importer)
        }
        return null
      }

      let ownedDependencies = dependencies.get(importerId)
      if (ownedDependencies === undefined) {
        ownedDependencies = new Set()
        dependencies.set(importerId, ownedDependencies)
      }
      ownedDependencies.add(importedId)
      const inheritedOwnership = clientOwnedModule(applicationRoot, resolvedId)
        ? CLIENT
        : importerOwnership
      if (inheritedOwnership !== 0) {
        markOwnership(importedId, inheritedOwnership)
      }
      return null
    },
  }
}
