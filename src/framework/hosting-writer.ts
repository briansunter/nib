import fs from 'node:fs/promises'
import path from 'node:path'
import { hostingArtifacts } from './hosting'
import type { PublicationManifest } from './publication'
import type { NibHostingConfig } from './types'

/** @internal Writes generated hosting companions into the completed client output. */
export async function writeHostingArtifacts(
  clientDirectory: string,
  manifest: PublicationManifest,
  config: NibHostingConfig | undefined,
): Promise<void> {
  const adapters = [...new Set(config?.adapters ?? [])]
  const artifacts = new Map<string, { adapter: string; body: string }>()
  for (const adapter of adapters) {
    for (const artifact of hostingArtifacts(manifest, adapter)) {
      const existing = artifacts.get(artifact.path)
      if (existing !== undefined && existing.body !== artifact.body) {
        throw new Error(
          `Hosting adapters ${existing.adapter} and ${adapter} both own `
          + `${artifact.path} with incompatible contents; configure only one of them`,
        )
      }
      artifacts.set(artifact.path, { adapter, body: artifact.body })
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
}
