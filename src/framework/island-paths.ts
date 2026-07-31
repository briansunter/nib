import { validateClientId } from './client-paths'

export function validateIslandId(id: string): string {
  return validateClientId(id, 'island')
}

export function islandFileToId(file: string): string {
  const normalized = file.split('?')[0].replaceAll('\\', '/')
  const match = normalized.match(/(?:^|\/)islands\/(.+)\.tsx$/)
  if (!match) throw new Error(`Invalid island file: ${file}`)
  return validateIslandId(match[1])
}
