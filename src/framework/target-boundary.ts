import path from 'node:path'
import type { Plugin } from 'vite'
import type { NibViteTarget } from './plugin'

const CLIENT_MODULE = /\.client(?:\.[cm]?[jt]sx?)?$/
const SERVER_MODULE = /\.server(?:\.[cm]?[jt]sx?)?$/

function cleanId(id: string): string {
  return id.replace(/[?#].*$/, '').replaceAll('\\', '/')
}

function resolvedImport(id: string, importer: string | undefined): string {
  const clean = cleanId(id)
  if (importer === undefined || !clean.startsWith('.')) return clean
  return path.resolve(path.dirname(cleanId(importer)), clean).replaceAll('\\', '/')
}

function chainFor(
  source: string,
  importer: string | undefined,
  parents: ReadonlyMap<string, string>,
): string {
  const chain = [source]
  let current = importer === undefined ? undefined : cleanId(importer)
  const seen = new Set<string>()
  while (current !== undefined && !seen.has(current)) {
    seen.add(current)
    chain.push(current)
    current = parents.get(current)
  }
  return chain.reverse().join('\n  -> ')
}

/** Enforces explicit `.client.*` and `.server.*` module ownership. */
export function targetBoundaryGuard(target: NibViteTarget): Plugin {
  const parents = new Map<string, string>()
  return {
    name: `nib-${target}-module-boundary`,
    enforce: 'pre',
    resolveId(source, importer) {
      const resolved = resolvedImport(source, importer)
      if (importer !== undefined) parents.set(resolved, cleanId(importer))
      const forbidden = target === 'client'
        ? SERVER_MODULE.test(resolved)
        : target === 'server'
          ? CLIENT_MODULE.test(resolved)
          : false
      if (!forbidden) return null
      const boundary = target === 'client' ? 'server-only' : 'client-only'
      throw new Error(
        `Nib ${target} graph cannot import ${boundary} module:\n  ${chainFor(resolved, importer, parents)}`,
      )
    },
  }
}
