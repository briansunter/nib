import { isFileRoute, publicRouteHref } from './publication'
import type { PublicationManifest, PublicationManifestRoute } from './publication'
import type { NibHostingAdapter } from './types'

export interface HostingArtifact {
  readonly path: string
  readonly body: string
}

function slashRedirects(manifest: PublicationManifest): Array<{ source: string; destination: string }> {
  if (manifest.trailingSlash === 'ignore') return []
  const redirects: Array<{ source: string; destination: string }> = []
  for (const route of manifest.routes) {
    if (route.kind === 'resource' && isFileRoute(route.path)) continue
    if (route.path === '/' || isFileRoute(route.path)) continue
    const canonical = publicRouteHref(manifest.base, route.path)
    const alternate = manifest.trailingSlash === 'always'
      ? canonical.replace(/\/$/, '')
      : `${canonical}/`
    redirects.push({ source: alternate, destination: canonical })
  }
  return redirects
}

function redirectsFile(manifest: PublicationManifest): string {
  return `${slashRedirects(manifest)
    .map(({ source, destination }) => `${source} ${destination} 301!`)
    .join('\n')}\n`
}

function vercelFile(manifest: PublicationManifest): string {
  return `${JSON.stringify({
    version: 2,
    redirects: slashRedirects(manifest).map(({ source, destination }) => ({
      source,
      destination,
      permanent: true,
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
    redirects: slashRedirects(manifest),
    routes: manifest.routes.map((route: PublicationManifestRoute) => ({
      path: publicRouteHref(manifest.base, route.path),
      artifact: route.artifact,
      contentType: route.contentType,
    })),
  }, null, 2)}\n`
}

export function hostingArtifacts(
  manifest: PublicationManifest,
  adapter: NibHostingAdapter,
): readonly HostingArtifact[] {
  if (adapter === 'netlify') return [{ path: '_redirects', body: redirectsFile(manifest) }]
  if (adapter === 'vercel') return [{ path: 'vercel.json', body: vercelFile(manifest) }]
  if (adapter === 'cloudflare') return [
    { path: '_redirects', body: redirectsFile(manifest) },
    { path: '_headers', body: headersFile(manifest) },
  ]
  return [{ path: 's3-website.json', body: s3File(manifest) }]
}
