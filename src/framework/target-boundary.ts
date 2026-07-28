import path from 'node:path'
import type { Plugin } from 'vite'
import type { NibViteTarget } from './plugin'

type ModuleTarget = Exclude<NibViteTarget, 'development'>

const CLIENT_MODULE = /\.client(?:\.[cm]?[jt]sx?)?$/
const SERVER_MODULE = /\.server(?:\.[cm]?[jt]sx?)?$/

function cleanId(id: string): string {
  const query = id.indexOf('?')
  const fragment = id.indexOf('#', id.startsWith('#') ? 1 : 0)
  const end = Math.min(
    query === -1 ? id.length : query,
    fragment === -1 ? id.length : fragment,
  )
  return id.slice(0, end).replaceAll('\\', '/')
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

function moduleTarget(
  configuredTarget: NibViteTarget,
  consumer: 'client' | 'server' | undefined,
): ModuleTarget | undefined {
  if (configuredTarget !== 'development') return configuredTarget
  return consumer
}

function forbiddenBoundary(
  target: ModuleTarget,
  id: string,
): 'client-only' | 'server-only' | undefined {
  if (target === 'client' && SERVER_MODULE.test(cleanId(id))) return 'server-only'
  if (target === 'server' && CLIENT_MODULE.test(cleanId(id))) return 'client-only'
  return undefined
}

function environmentConsumer(context: unknown): 'client' | 'server' | undefined {
  const consumer = (
    context as {
      environment?: { config?: { consumer?: unknown } }
    }
  ).environment?.config?.consumer
  return consumer === 'client' || consumer === 'server' ? consumer : undefined
}

function assertAllowed(
  target: ModuleTarget | undefined,
  id: string,
  importer: string | undefined,
  parents: ReadonlyMap<string, string>,
): void {
  if (target === undefined) return
  const boundary = forbiddenBoundary(target, id)
  if (boundary === undefined) return
  throw new Error(
    `Nib ${target} graph cannot import ${boundary} module:\n  ${chainFor(cleanId(id), importer, parents)}`,
  )
}

/** Enforces explicit `.client.*` and `.server.*` module ownership. */
export function targetBoundaryGuard(target: NibViteTarget): Plugin {
  const parents: Record<ModuleTarget, Map<string, string>> = {
    client: new Map(),
    server: new Map(),
  }
  return {
    name: `nib-${target}-module-boundary`,
    enforce: 'pre',
    resolveId(source, importer) {
      const activeTarget = moduleTarget(target, environmentConsumer(this))
      if (activeTarget === undefined) return null
      const graphParents = parents[activeTarget]
      const resolved = resolvedImport(source, importer)
      if (importer !== undefined) graphParents.set(resolved, cleanId(importer))
      assertAllowed(activeTarget, resolved, importer, graphParents)
      return null
    },
    transform(_code, id) {
      const activeTarget = moduleTarget(target, environmentConsumer(this))
      if (activeTarget === undefined) return null
      const graphParents = parents[activeTarget]
      const resolved = cleanId(id)
      assertAllowed(activeTarget, resolved, graphParents.get(resolved), graphParents)
      return null
    },
  }
}
