export { stripBasePath } from './publication'
import { canonicalRoutePath } from './publication'

export function siteHref(path: string): string {
  const base = configuredBasePath()
  const parsed = new URL(path, 'http://nib.local')
  const routePath = parsed.pathname.startsWith('/') ? parsed.pathname : `/${parsed.pathname}`
  const policy = configuredTrailingSlash()
  const publicPath = policy === 'ignore' ? routePath : canonicalRoutePath(routePath, policy)
  const joined = `${base}${publicPath.replace(/^\/+/, '')}`
  return `${joined}${parsed.search}${parsed.hash}`
}
declare const __NIB_BASE_PATH__: string
declare const __NIB_TRAILING_SLASH__: 'always' | 'never' | 'ignore'

function configuredBasePath(): string {
  return typeof __NIB_BASE_PATH__ === 'string' ? __NIB_BASE_PATH__ : '/'
}

function configuredTrailingSlash(): 'always' | 'never' | 'ignore' {
  return typeof __NIB_TRAILING_SLASH__ === 'string'
    ? __NIB_TRAILING_SLASH__
    : 'ignore'
}
