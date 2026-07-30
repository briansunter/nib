import { isFileRoute, publicRouteHref } from './publication'
import type { PublicationManifest, PublicationManifestRoute } from './publication'
import type { NibHostingAdapter, NibHostingAdapterConfig } from './types'

export interface HostingArtifact {
  readonly path: string
  readonly body: string
}

/** Normalizes either adapter form into a config object for per-adapter dispatch. */
export function normalizeHostingAdapter(
  adapter: NibHostingAdapter | NibHostingAdapterConfig,
): NibHostingAdapterConfig {
  return typeof adapter === 'string' ? { name: adapter } : adapter
}

interface HostingRedirectRule {
  readonly source: string
  readonly destination: string
  readonly status: number
}

function redirectRules(
  manifest: PublicationManifest,
  includeSlashAliases = true,
): readonly HostingRedirectRule[] {
  const redirects: HostingRedirectRule[] = []

  for (const route of manifest.routes) {
    if (route.kind !== 'redirect') continue
    if (route.destination === undefined) {
      throw new Error(`Publication redirect ${route.path} is missing its destination`)
    }
    redirects.push({
      source: publicRouteHref(manifest.base, route.path),
      destination: route.destination,
      status: route.status,
    })
  }

  if (!includeSlashAliases || manifest.trailingSlash === 'ignore') return redirects
  for (const route of manifest.routes) {
    if (route.kind === 'resource' && isFileRoute(route.path)) continue
    if (route.path === '/' || isFileRoute(route.path)) continue
    const canonical = publicRouteHref(manifest.base, route.path)
    const alternate = manifest.trailingSlash === 'always'
      ? canonical.replace(/\/$/, '')
      : `${canonical}/`
    redirects.push({ source: alternate, destination: canonical, status: 301 })
  }
  return redirects
}

function redirectsFile(manifest: PublicationManifest): string {
  return `${redirectRules(manifest)
    .map(({ source, destination, status }) => `${source} ${destination} ${status}`)
    .join('\n')}\n`
}

function assertNetlifyRedirects(manifest: PublicationManifest): void {
  const unsupported = redirectRules(manifest, false).find(({ status }) => (
    status !== 301 && status !== 302
  ))
  if (unsupported !== undefined) {
    throw new Error(
      `Netlify does not support redirect status ${unsupported.status} for `
      + `${unsupported.source}; use 301 or 302, or remove the Netlify adapter`,
    )
  }
}

function vercelFile(manifest: PublicationManifest): string {
  return `${JSON.stringify({
    version: 2,
    redirects: redirectRules(manifest).map(({ source, destination, status }) => ({
      source,
      destination,
      statusCode: status,
    })),
    headers: [{
      source: `${manifest.base}assets/nib/(.*)`,
      headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
    }],
  }, null, 2)}\n`
}

function headersFile(manifest: PublicationManifest): string {
  return `${publicRouteHref(manifest.base, '/assets/nib')}/*\n  Cache-Control: public, max-age=31536000, immutable\n`
}

function s3File(manifest: PublicationManifest): string {
  return `${JSON.stringify({
    version: 1,
    trailingSlash: manifest.trailingSlash,
    redirects: redirectRules(manifest),
    routes: manifest.routes.map((route: PublicationManifestRoute) => ({
      path: publicRouteHref(manifest.base, route.path),
      artifact: route.artifact,
      contentType: route.contentType,
    })),
  }, null, 2)}\n`
}

export function hostingArtifacts(
  manifest: PublicationManifest,
  adapter: NibHostingAdapter | NibHostingAdapterConfig,
): readonly HostingArtifact[] {
  const config = normalizeHostingAdapter(adapter)
  if (config.name === 'netlify') {
    assertNetlifyRedirects(manifest)
    // Netlify normalizes trailing slashes before matching redirect rules, so
    // forced slash aliases can loop. Its static-file routing owns that policy.
    return [{
      path: '_redirects',
      body: `${redirectRules(manifest, false)
        .map(({ source, destination, status }) => `${source} ${destination} ${status}!`)
        .join('\n')}\n`,
    }]
  }
  if (config.name === 'vercel') return [{ path: 'vercel.json', body: vercelFile(manifest) }]
  if (config.name === 'cloudflare') return [
    { path: '_redirects', body: redirectsFile(manifest) },
    { path: '_headers', body: headersFile(manifest) },
  ]
  if (config.name === 's3') return [{ path: 's3-website.json', body: s3File(manifest) }]
  throw new Error(`Unsupported Nib hosting adapter: ${config.name}`)
}
