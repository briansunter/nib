const ISLAND_SEGMENT = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

export function validateIslandId(id: string): string {
  const normalized = id.replaceAll('\\', '/').replace(/^\/+|\/+$/g, '')
  if (!normalized || normalized.split('/').some((segment) => !ISLAND_SEGMENT.test(segment))) {
    throw new Error(`Invalid island ID: ${id}`)
  }
  return normalized
}

export function islandFileToId(file: string): string {
  const normalized = file.split('?')[0].replaceAll('\\', '/')
  const match = normalized.match(/(?:^|\/)islands\/(.+)\.tsx$/)
  if (!match) throw new Error(`Invalid island file: ${file}`)
  return validateIslandId(match[1])
}
