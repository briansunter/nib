import fs from 'node:fs/promises'
import path from 'node:path'
import type { PublicationManifest, PublicationManifestRoute } from './publication'
import type { NibBuildOutput } from './types'

function isNotFound(error: unknown): boolean {
  return typeof error === 'object'
    && error !== null
    && 'code' in error
    && (error as { code?: unknown }).code === 'ENOENT'
}

function safeArtifact(clientDirectory: string, artifact: string, label: string): string {
  if (
    typeof artifact !== 'string'
    || artifact === ''
    || artifact.includes('\\')
    || path.isAbsolute(artifact)
  ) {
    throw new Error(`${label} must be a non-empty relative forward-slash path`)
  }
  const resolved = path.resolve(clientDirectory, artifact)
  const relative = path.relative(clientDirectory, resolved)
  if (relative.startsWith('..') || path.isAbsolute(relative) || relative === '') {
    throw new Error(`${label} escapes the build output directory: ${artifact}`)
  }
  return resolved
}

function resolveRouteArtifact(
  clientDirectory: string,
  manifest: PublicationManifest,
  route: PublicationManifestRoute,
  label: string,
): string {
  const known = manifest.routes.find(
    (entry) => entry.path === route.path && entry.kind === route.kind,
  )
  const artifact = known?.artifact ?? route.artifact
  return safeArtifact(clientDirectory, artifact, `${label} artifact`)
}

async function replaceDirectory(current: string, staging: string): Promise<void> {
  const backup = `${current}.previous`
  let hasBackup = false
  try {
    await fs.rename(current, backup)
    hasBackup = true
  } catch (error) {
    if (!isNotFound(error)) throw error
  }
  try {
    await fs.rename(staging, current)
  } catch (error) {
    if (hasBackup) {
      try {
        await fs.rename(backup, current)
      } catch (rollbackError) {
        throw new AggregateError(
          [error, rollbackError],
          `Failed to publish staged output and restore ${current}`,
        )
      }
    }
    throw error
  }
  if (hasBackup) await fs.rm(backup, { recursive: true, force: true })
}

export function createBuildOutput(
  clientDirectory: string,
  manifest: PublicationManifest,
): NibBuildOutput {
  return {
    async readText(route) {
      return fs.readFile(
        resolveRouteArtifact(clientDirectory, manifest, route, 'output.readText'),
        'utf8',
      )
    },
    async readBytes(route) {
      return Promise.resolve(
        new Uint8Array(
          await fs.readFile(
            resolveRouteArtifact(clientDirectory, manifest, route, 'output.readBytes'),
          ),
        ),
      )
    },
    async write(artifact, body) {
      const target = safeArtifact(clientDirectory, artifact, 'output.write artifact')
      await fs.mkdir(path.dirname(target), { recursive: true })
      const tmp = `${target}.tmp-${process.pid}`
      await fs.writeFile(tmp, body)
      await fs.rename(tmp, target)
    },
    async stageDirectory(name) {
      const safeName = typeof name === 'string' && /^[A-Za-z0-9._-]+$/.test(name)
        ? name
        : (() => { throw new Error('output.stageDirectory name must be a flat identifier') })()
      const staging = await fs.mkdtemp(path.join(clientDirectory, `.nib-${safeName}-`))
      return {
        path: staging,
        async publishTo(target) {
          const dest = safeArtifact(clientDirectory, target, 'staged output target')
          await replaceDirectory(dest, staging)
        },
      }
    },
  }
}
