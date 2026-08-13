import crypto from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import type { PublicationManifest, PublicationManifestRoute } from './publication'
import type { NibBuildOutput, StagedDirectory } from './types'

interface StageRecord {
  readonly name: string
  readonly path: string
  state: 'open' | 'publishing' | 'published' | 'failed'
  work?: Promise<void>
}

export interface BuildOutputSession {
  readonly output: NibBuildOutput
  /** Verifies every stage was published and waits for any publication in progress. */
  complete(): Promise<void>
  /** Waits for in-progress publications and removes every unpublished stage. */
  abort(): Promise<void>
}

type SessionState = 'open' | 'closing' | 'closed'

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

async function rejectSymbolicLinkComponents(
  clientDirectory: string,
  target: string,
  label: string,
): Promise<void> {
  const relative = path.relative(clientDirectory, target)
  const components = relative === '' ? [] : relative.split(path.sep)
  let current = clientDirectory

  for (const component of ['', ...components]) {
    if (component !== '') current = path.join(current, component)
    let stats
    try {
      stats = await fs.lstat(current)
    } catch (error) {
      // Once an ancestor does not exist, none of its descendants can exist.
      // Callers that create directories validate the completed path again.
      if (isNotFound(error)) return
      throw error
    }
    if (stats.isSymbolicLink()) {
      const link = path.relative(clientDirectory, current).split(path.sep).join('/') || '.'
      throw new Error(
        `${label} cannot traverse symbolic links in the build output directory: ${link}`,
      )
    }
  }
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
  if (known === undefined) {
    throw new Error(
      `${label} route is not present in the publication manifest: ${String(route.path)}`,
    )
  }
  return safeArtifact(clientDirectory, known.artifact, `${label} artifact`)
}

async function replaceDirectory(current: string, staging: string): Promise<void> {
  const backup = `${current}.previous-${process.pid}-${crypto.randomUUID()}`
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
        hasBackup = false
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

async function removeStages(records: readonly StageRecord[]): Promise<unknown[]> {
  const results = await Promise.allSettled(records.map((record) => (
    fs.rm(record.path, { recursive: true, force: true })
  )))
  return results.flatMap((result) => result.status === 'rejected' ? [result.reason] : [])
}

function throwErrors(errors: readonly unknown[], message: string): void {
  if (errors.length === 0) return
  if (errors.length === 1) throw errors[0]
  throw new AggregateError(errors, message)
}

export function createBuildOutputSession(
  clientDirectory: string,
  manifest: PublicationManifest,
): BuildOutputSession {
  const resolvedClientDirectory = path.resolve(clientDirectory)
  const stages = new Set<StageRecord>()
  const publications = new Map<string, Promise<void>>()
  const writes = new Set<Promise<void>>()
  const stageCreations = new Set<Promise<unknown>>()
  let state: SessionState = 'open'
  let finalization: Promise<void> | undefined

  function assertOpen(operation: string): void {
    if (state !== 'open') {
      throw new Error(`${operation} cannot run after the Nib build output session starts closing`)
    }
  }

  function beginClosing(operation: string): void {
    if (state !== 'open') {
      throw new Error(`Nib build output session cannot ${operation} more than once`)
    }
    state = 'closing'
  }

  function track<T>(pending: Set<Promise<unknown>>, work: Promise<T>): Promise<T> {
    pending.add(work)
    // Retain settled operations until finalization so a fire-and-forget
    // failure cannot disappear before complete() observes it.
    void work.catch(() => undefined)
    return work
  }

  async function settlePending(pending: Set<Promise<unknown>>): Promise<unknown[]> {
    const results = await Promise.allSettled([...pending])
    return results.flatMap((result) => result.status === 'rejected' ? [result.reason] : [])
  }

  const output: NibBuildOutput = {
    readText(route) {
      return (async () => {
        assertOpen('output.readText')
        const target = resolveRouteArtifact(
          resolvedClientDirectory,
          manifest,
          route,
          'output.readText',
        )
        await rejectSymbolicLinkComponents(resolvedClientDirectory, target, 'output.readText')
        return fs.readFile(target, 'utf8')
      })()
    },
    readBytes(route) {
      return (async () => {
        assertOpen('output.readBytes')
        const target = resolveRouteArtifact(
          resolvedClientDirectory,
          manifest,
          route,
          'output.readBytes',
        )
        await rejectSymbolicLinkComponents(resolvedClientDirectory, target, 'output.readBytes')
        return new Uint8Array(await fs.readFile(target))
      })()
    },
    write(artifact, body) {
      const work = (async (): Promise<void> => {
        assertOpen('output.write')
        const target = safeArtifact(resolvedClientDirectory, artifact, 'output.write artifact')
        await rejectSymbolicLinkComponents(
          resolvedClientDirectory,
          target,
          'output.write artifact',
        )
        await fs.mkdir(path.dirname(target), { recursive: true })
        await rejectSymbolicLinkComponents(
          resolvedClientDirectory,
          target,
          'output.write artifact',
        )
        const temporary = `${target}.tmp-${process.pid}-${crypto.randomUUID()}`
        try {
          await fs.writeFile(temporary, body, { flag: 'wx' })
          await rejectSymbolicLinkComponents(
            resolvedClientDirectory,
            target,
            'output.write artifact',
          )
          await fs.rename(temporary, target)
        } finally {
          await fs.rm(temporary, { force: true })
        }
      })()
      return track(writes, work)
    },
    stageDirectory(name) {
      const creation = (async (): Promise<StagedDirectory> => {
        assertOpen('output.stageDirectory')
        const safeName = typeof name === 'string' && /^[A-Za-z0-9._-]+$/.test(name)
          ? name
          : (() => { throw new Error('output.stageDirectory name must be a flat identifier') })()
        // A stage is deliberately adjacent to, never inside, the deployable
        // client directory. Even a consumer using createBuildOutput() directly
        // cannot accidentally include an unpublished stage in its deployment.
        const staging = await fs.mkdtemp(
          path.join(path.dirname(resolvedClientDirectory), `.nib-${safeName}-`),
        )
        const record: StageRecord = {
          name: safeName,
          path: staging,
          state: 'open',
        }
        stages.add(record)
        return {
          path: staging,
          publishTo(target: string) {
            if (state !== 'open') {
              return Promise.reject(new Error(
                'staged output publishTo cannot run after the Nib build output session starts closing',
              ))
            }
            if (record.state !== 'open') {
              return Promise.reject(
                new Error(`staged output ${JSON.stringify(safeName)} can only be published once`),
              )
            }
            record.state = 'publishing'
            const work = (async (): Promise<void> => {
              let publicationFailed = false
              let publicationError: unknown
              try {
                const destination = safeArtifact(
                  resolvedClientDirectory,
                  target,
                  'staged output target',
                )
                const previous = publications.get(destination)
                const replacement = (async (): Promise<void> => {
                  if (previous !== undefined) await previous.catch(() => undefined)
                  await rejectSymbolicLinkComponents(
                    resolvedClientDirectory,
                    destination,
                    'staged output target',
                  )
                  await replaceDirectory(destination, staging)
                })()
                publications.set(destination, replacement)
                void replacement.finally(() => {
                  if (publications.get(destination) === replacement) {
                    publications.delete(destination)
                  }
                }).catch(() => undefined)
                await replacement
              } catch (error) {
                record.state = 'failed'
                publicationFailed = true
                publicationError = error
              }
              try {
                await fs.rm(staging, { recursive: true, force: true })
              } catch (cleanupError) {
                record.state = 'failed'
                if (publicationFailed) {
                  throw new AggregateError(
                    [publicationError, cleanupError],
                    `Failed to publish and clean staged output ${JSON.stringify(safeName)}`,
                  )
                }
                throw cleanupError
              }
              if (publicationFailed) throw publicationError
              record.state = 'published'
            })()
            // Keep a handler attached even when a plugin forgets to await the
            // returned promise; complete() still observes and reports failure.
            void work.catch(() => undefined)
            record.work = work
            return work
          },
        }
      })()
      return track(stageCreations, creation)
    },
  }

  async function waitForPublications(records: readonly StageRecord[]): Promise<unknown[]> {
    const work = records.flatMap((record) => record.work === undefined ? [] : [record.work])
    const results = await Promise.allSettled(work)
    return results.flatMap((result) => result.status === 'rejected' ? [result.reason] : [])
  }

  return {
    output,
    async complete() {
      beginClosing('complete')
      const work = (async (): Promise<void> => {
        try {
          const creationErrors = await settlePending(stageCreations)
          const writeErrors = await settlePending(writes)
          const records = [...stages]
          const publicationErrors = await waitForPublications(records)
          const unpublished = records.filter((record) => record.state === 'open')
          const cleanupErrors = await removeStages(records)
          const errors: unknown[] = [...creationErrors, ...writeErrors, ...publicationErrors]
          if (unpublished.length > 0) {
            errors.unshift(new Error(
              `Nib finalizers left unpublished staged output: ${unpublished
                .map((record) => JSON.stringify(record.name))
                .join(', ')}`,
            ))
          }
          errors.push(...cleanupErrors)
          throwErrors(errors, 'Nib build output finalization failed')
        } finally {
          stages.clear()
          writes.clear()
          stageCreations.clear()
          state = 'closed'
        }
      })()
      finalization = work
      return work
    },
    async abort() {
      if (state === 'closed') return
      if (state === 'closing') {
        await finalization?.catch(() => undefined)
        return
      }
      beginClosing('abort')
      const work = (async (): Promise<void> => {
        try {
          await settlePending(stageCreations)
          await settlePending(writes)
          const records = [...stages]
          await Promise.allSettled(records.flatMap((record) => (
            record.work === undefined ? [] : [record.work]
          )))
          const cleanupErrors = await removeStages(records)
          throwErrors(cleanupErrors, 'Nib build output cleanup failed')
        } finally {
          stages.clear()
          writes.clear()
          stageCreations.clear()
          state = 'closed'
        }
      })()
      finalization = work
      return work
    },
  }
}

export function createBuildOutput(
  clientDirectory: string,
  manifest: PublicationManifest,
): NibBuildOutput {
  return createBuildOutputSession(clientDirectory, manifest).output
}
