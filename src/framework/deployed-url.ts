/** Origin-aware URL construction shared by resource-route serializers. */
export function deployedOrigin(
  value: string | URL | undefined,
  fallback: string | undefined,
  label: string,
): URL {
  const candidate = value ?? fallback
  if (candidate === undefined) throw new Error(`${label} requires site.origin or an explicit site option`)
  const origin = new URL(candidate)
  if (!['http:', 'https:'].includes(origin.protocol)) {
    throw new Error(`${label} must use HTTP or HTTPS`)
  }
  if (origin.pathname !== '/' || origin.search !== '' || origin.hash !== '') {
    throw new Error(`${label} must be an origin without a path, query, or hash`)
  }
  return origin
}

function basePath(base: string): string {
  return base === '/' ? '/' : `/${base.replace(/^\/+|\/+$/g, '')}/`
}

export function deployedRouteUrl(site: URL, base: string, routePath: string): string {
  const relative = routePath === '/' ? '' : routePath.replace(/^\/+/, '')
  return new URL(`${basePath(base)}${relative}`, site).href
}

export function deployedLinkUrl(
  value: string | URL,
  site: URL,
  base: string,
  label: string,
): string {
  if (value instanceof URL) {
    if (!['http:', 'https:'].includes(value.protocol)) throw new Error(`${label} must use HTTP or HTTPS`)
    return value.href
  }
  if (typeof value !== 'string' || value.trim() === '') throw new Error(`${label} must be a non-empty string`)
  if (value.startsWith('/')) return deployedRouteUrl(site, base, value)
  let url: URL
  try {
    url = new URL(value)
  } catch {
    throw new Error(`${label} must be an absolute URL or an absolute route path`)
  }
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error(`${label} must use HTTP or HTTPS`)
  return url.href
}
