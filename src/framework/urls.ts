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
  return `${configuredBasePath()}${path.replace(/^\/+/, '')}`
}
declare const __NIB_BASE_PATH__: string

function configuredBasePath(): string {
  return typeof __NIB_BASE_PATH__ === 'string' ? __NIB_BASE_PATH__ : '/'
}
