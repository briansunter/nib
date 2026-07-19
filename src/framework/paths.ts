import type { TrailingSlash } from './types'

export function normalizePath(url: string): string {
  const pathname = new URL(url, 'http://nib.local').pathname
  if (pathname === '/') return '/'
  return pathname.replace(/\/+$/, '')
}

export function isFileRoute(pathname: string): boolean {
  const segment = pathname.replace(/\/+$/, '').split('/').at(-1) ?? ''
  return /\.[A-Za-z0-9]+$/.test(segment)
}

export function canonicalRoutePath(
  value: string,
  trailingSlash: TrailingSlash = 'ignore',
): string {
  const path = normalizePath(value)
  if (path === '/' || isFileRoute(path)) return path
  return trailingSlash === 'always' ? `${path}/` : path
}

export function fileToRoute(file: string): string {
  const normalized = file.replaceAll('\\', '/')
  const match = normalized.match(/(?:^|\/)pages\/(.*)\/page\.[A-Za-z0-9]+$/)
    ?? normalized.match(/(?:^|\/)pages\/page\.[A-Za-z0-9]+$/)

  if (!match) throw new Error(`Invalid page file: ${file}`)
  if (!match[1]) return '/'
  return `/${match[1]}`.replace(/\/+/g, '/')
}
