export function stripBasePath(path: string, basePath: string): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  const normalizedBase = basePath.startsWith('/') ? basePath : `/${basePath}`
  const prefix = normalizedBase.replace(/\/+$/, '')

  if (!prefix) return normalizedPath
  if (normalizedPath === prefix || normalizedPath === `${prefix}/`) return '/'
  return normalizedPath.startsWith(`${prefix}/`)
    ? normalizedPath.slice(prefix.length) || '/'
    : normalizedPath
}

export function siteHref(path: string) {
  return `${import.meta.env.BASE_URL}${path.replace(/^\/+/, '')}`
}
