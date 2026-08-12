const ISLAND_ID_SEGMENT = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

export const ISLAND_SOURCE_GLOB = 'src/islands/**/*.tsx'
export const ISLAND_MODULE_GLOB = [
  `/${ISLAND_SOURCE_GLOB}`,
  '!/src/islands/**/*.test.tsx',
  '!/src/islands/**/*.spec.tsx',
] as const

export function validateIslandId(id: unknown): string {
  if (typeof id !== 'string') {
    throw new Error(`Invalid island ID: ${String(id)}`)
  }
  const normalized = id.replaceAll('\\', '/').replace(/^\/+|\/+$/g, '')
  if (
    normalized === ''
    || normalized.split('/').some((segment) => !ISLAND_ID_SEGMENT.test(segment))
  ) {
    throw new Error(`Invalid island ID: ${id}`)
  }
  return normalized
}

export function islandFileToId(file: string): string {
  const normalized = file.split('?')[0]!.replaceAll('\\', '/')
  const match = normalized.match(/(?:^|\/)islands\/(.+)\.tsx$/)
  if (match === null) throw new Error(`Invalid island file: ${file}`)
  return validateIslandId(match[1])
}
