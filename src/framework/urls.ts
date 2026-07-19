export function stripBasePath(path: string, basePath: string): string {
  const parsed = new URL(path, 'http://nib.local')
  const normalizedPath = parsed.pathname.startsWith('/') ? parsed.pathname : `/${parsed.pathname}`
  const normalizedBase = basePath.startsWith('/') ? basePath : `/${basePath}`
  const prefix = normalizedBase.replace(/\/+$/, '')

  let stripped = normalizedPath
  if (prefix && (normalizedPath === prefix || normalizedPath === `${prefix}/`)) {
    stripped = '/'
  } else if (prefix && normalizedPath.startsWith(`${prefix}/`)) {
    stripped = normalizedPath.slice(prefix.length) || '/'
  }

  return `${stripped}${parsed.search}${parsed.hash}`
}

export function siteHref(path: string) {
  const base = configuredBasePath()
  const joined = `${base}${path.replace(/^\/+/, '')}`
  if (
    configuredTrailingSlash() === 'always'
    && joined !== base
    && !joined.endsWith('/')
    && !/\.[A-Za-z0-9]+(?:[?#]|$)/.test(joined)
  ) {
    return `${joined}/`
  }
  if (configuredTrailingSlash() === 'never' && joined !== base) {
    return joined.replace(/\/+$/, '')
  }
  return joined
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
