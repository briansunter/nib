export type ModuleTarget = 'client' | 'server'

const TARGET_MODULE = /\.(client|server)(?:\.[cm]?[jt]sx?)?$/

/** Removes Vite queries/fragments and normalizes separators for policy checks. */
export function cleanModuleId(id: string): string {
  const query = id.indexOf('?')
  const fragment = id.indexOf('#', id.startsWith('#') ? 1 : 0)
  const end = Math.min(
    query === -1 ? id.length : query,
    fragment === -1 ? id.length : fragment,
  )
  return id.slice(0, end).replaceAll('\\', '/')
}
/** Returns explicit ownership declared by a `.client.*` or `.server.*` suffix. */
export function moduleTarget(id: string): ModuleTarget | undefined {
  return TARGET_MODULE.exec(cleanModuleId(id))?.[1] as ModuleTarget | undefined
}
