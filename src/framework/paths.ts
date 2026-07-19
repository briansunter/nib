export {
  canonicalRoutePath,
  isFileRoute,
  normalizePath,
} from './publication'

export function fileToRoute(file: string): string {
  const normalized = file.replaceAll('\\', '/')
  const match = normalized.match(/(?:^|\/)pages\/(.*)\/page\.[A-Za-z0-9]+$/)
    ?? normalized.match(/(?:^|\/)pages\/page\.[A-Za-z0-9]+$/)

  if (!match) throw new Error(`Invalid page file: ${file}`)
  if (!match[1]) return '/'
  return `/${match[1]}`.replace(/\/+/g, '/')
}
