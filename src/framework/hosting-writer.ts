import fs from 'node:fs/promises'
import path from 'node:path'
import { hostingArtifacts, normalizeHostingAdapter } from './hosting'
import type { PublicationManifest, PublicationManifestRoute } from './publication'
import type { NibHostingConfig } from './types'

/** Companion object path a host that serves /foo as /foo.html expects (HTML routes only). */
function s3HtmlAlias(route: PublicationManifestRoute): string | undefined {
  if (!route.contentType.toLowerCase().startsWith('text/html')) return undefined
  if (route.path === '/') return 'index.html'
  return `${route.path.slice(1)}.html`
}

function assertWithinClientDirectory(
  resolved: string,
  clientDirectory: string,
  label: string,
): void {
  const relativePath = path.relative(clientDirectory, resolved)
  if (relativePath === '' || relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
    throw new Error(`Hosting HTML alias ${label} escapes the client output directory`)
  }
}

/** @internal Writes generated hosting companions into the completed client output. */
export async function writeHostingArtifacts(
  clientDirectory: string,
  manifest: PublicationManifest,
  config: NibHostingConfig | undefined,
): Promise<void> {
  const adapters = [...new Set(config?.adapters ?? [])].map(normalizeHostingAdapter)
  const artifacts = new Map<string, { adapter: string; body: string }>()
  for (const adapter of adapters) {
    for (const artifact of hostingArtifacts(manifest, adapter)) {
      const existing = artifacts.get(artifact.path)
      if (existing !== undefined && existing.body !== artifact.body) {
        throw new Error(
          `Hosting adapters ${existing.adapter} and ${adapter.name} both own `
          + `${artifact.path} with incompatible contents; configure only one of them`,
        )
      }
      artifacts.set(artifact.path, { adapter: adapter.name, body: artifact.body })
    }
  }
  const writes = await Promise.allSettled([...artifacts].map(async ([file, { body }]) => {
    const target = path.join(clientDirectory, file)
    await fs.mkdir(path.dirname(target), { recursive: true })
    await fs.writeFile(target, body)
  }))
  const failure = writes.find((result): result is PromiseRejectedResult => (
    result.status === 'rejected'
  ))
  if (failure !== undefined) throw failure.reason

  // S3 hosts that serve /foo as /foo.html need explicit companion objects.
  for (const adapter of adapters) {
    if (adapter.name !== 's3' || !adapter.htmlAliases) continue
    for (const route of manifest.routes) {
      const alias = s3HtmlAlias(route)
      if (alias === undefined) continue
      const source = path.resolve(clientDirectory, route.artifact)
      const destination = path.resolve(clientDirectory, alias)
      assertWithinClientDirectory(source, clientDirectory, route.artifact)
      assertWithinClientDirectory(destination, clientDirectory, alias)
      if (source === destination) continue
      await fs.mkdir(path.dirname(destination), { recursive: true })
      await fs.copyFile(source, destination)
    }
  }
}
