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
  const artifacts = new Map<string, string>()
  for (const adapter of adapters) {
    for (const artifact of hostingArtifacts(manifest, adapter)) artifacts.set(artifact.path, artifact.body)
  }
  await Promise.all([...artifacts].map(async ([file, body]) => {
    const target = path.join(clientDirectory, file)
    await fs.mkdir(path.dirname(target), { recursive: true })
    await fs.writeFile(target, body)
  }))
}
