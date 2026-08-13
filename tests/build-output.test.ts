import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  createBuildOutput,
  createBuildOutputSession,
  type BuildOutputSession,
} from '../src/framework/build-output'
import { defineCollection, fromCollection } from '../src/framework/content'
import { definePlugin } from '../src/framework/plugin'
import { createProjectRenderer } from '../src/framework/project-renderer'
import {
  createPublicationManifest,
  type PublicationManifestRoute,
} from '../src/framework/publication'

const temporaryDirectories: string[] = []

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => (
    fs.rm(directory, { recursive: true, force: true })
  )))
})

async function expectOutputSessionClosed(
  session: BuildOutputSession,
  route: PublicationManifestRoute,
): Promise<void> {
  await expect(session.output.readText(route)).rejects.toThrow('starts closing')
  await expect(session.output.readBytes(route)).rejects.toThrow('starts closing')
  await expect(session.output.write('late.txt', 'late')).rejects.toThrow('starts closing')
  await expect(session.output.stageDirectory('late')).rejects.toThrow('starts closing')
}

describe('createBuildOutput', () => {
  it('writes artifacts atomically under the client directory and rejects unsafe paths', async () => {
    const clientDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'nib-output-write-'))
    temporaryDirectories.push(clientDirectory)
    const output = createBuildOutput(
      clientDirectory,
      createPublicationManifest('/', 'ignore', []),
    )

    // Creates parent directories and writes the artifact at a relative path.
    await output.write('search/pagefind.json', '{"version":1}')
    expect(await fs.readFile(path.join(clientDirectory, 'search/pagefind.json'), 'utf8'))
      .toBe('{"version":1}')

    // A second write replaces the existing file atomically.
    await output.write('search/pagefind.json', '{"version":2}')
    expect(await fs.readFile(path.join(clientDirectory, 'search/pagefind.json'), 'utf8'))
      .toBe('{"version":2}')
    const leftovers = (await fs.readdir(path.join(clientDirectory, 'search')))
      .filter((entry) => entry.includes('.tmp-'))
    expect(leftovers).toEqual([])

    // Traversal and absolute artifacts are rejected before touching the filesystem.
    await expect(output.write('../escape', 'x')).rejects.toThrow(
      'output.write artifact escapes the build output directory: ../escape',
    )
    await expect(output.write('/escape.json', 'x')).rejects.toThrow(
      'output.write artifact must be a non-empty relative forward-slash path',
    )
  })

  it('uses unique temporary files for concurrent writes and cleans failed writes', async () => {
    const clientDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'nib-output-concurrent-write-'))
    temporaryDirectories.push(clientDirectory)
    const output = createBuildOutput(
      clientDirectory,
      createPublicationManifest('/', 'ignore', []),
    )
    const bodies = Array.from({ length: 12 }, (_, index) => `body-${index}`)

    await Promise.all(bodies.map((body) => output.write('generated/value.txt', body)))
    expect(bodies).toContain(
      await fs.readFile(path.join(clientDirectory, 'generated/value.txt'), 'utf8'),
    )
    expect((await fs.readdir(path.join(clientDirectory, 'generated')))
      .filter((entry) => entry.includes('.tmp-'))).toEqual([])

    await fs.mkdir(path.join(clientDirectory, 'blocked'))
    await expect(output.write('blocked', 'cannot replace a directory')).rejects.toThrow()
    expect((await fs.readdir(clientDirectory))
      .filter((entry) => entry.startsWith('blocked.tmp-'))).toEqual([])
  })

  it('refuses writes through a symlinked output parent', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'nib-output-write-symlink-'))
    temporaryDirectories.push(root)
    const clientDirectory = path.join(root, 'client')
    const outsideDirectory = path.join(root, 'outside')
    await fs.mkdir(clientDirectory)
    await fs.mkdir(outsideDirectory)
    await fs.symlink(
      outsideDirectory,
      path.join(clientDirectory, 'generated'),
      process.platform === 'win32' ? 'junction' : 'dir',
    )
    const output = createBuildOutput(
      clientDirectory,
      createPublicationManifest('/', 'ignore', []),
    )

    await expect(output.write('generated/escape.txt', 'must stay contained')).rejects.toThrow(
      'output.write artifact cannot traverse symbolic links in the build output directory: generated',
    )
    await expect(fs.access(path.join(outsideDirectory, 'escape.txt'))).rejects.toThrow()
    expect((await fs.lstat(path.join(clientDirectory, 'generated'))).isSymbolicLink()).toBe(true)
  })

  it('reads route artifacts through the publication manifest', async () => {
    const clientDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'nib-output-read-'))
    temporaryDirectories.push(clientDirectory)
    const manifest = createPublicationManifest('/', 'ignore', [
      {
        routePath: '/posts/hello',
        artifact: 'posts/hello.html',
        output: {
          kind: 'page',
          page: { status: 200, head: '', html: '<p>Hi</p>', enhancements: [], islands: [] },
        },
      },
    ])
    const output = createBuildOutput(clientDirectory, manifest)
    const route = manifest.routes[0]
    await fs.mkdir(path.join(clientDirectory, 'posts'), { recursive: true })
    await fs.writeFile(path.join(clientDirectory, 'posts/hello.html'), '<p>Hi</p>')

    expect(await output.readText(route)).toBe('<p>Hi</p>')
    const bytes = await output.readBytes(route)
    expect(bytes instanceof Uint8Array).toBe(true)
    expect(new TextDecoder().decode(bytes)).toBe('<p>Hi</p>')

    const unknown = { ...route, path: '/unknown' }
    await expect(output.readText(unknown)).rejects.toThrow(
      'output.readText route is not present in the publication manifest: /unknown',
    )
    await expect(output.readBytes(unknown)).rejects.toThrow(
      'output.readBytes route is not present in the publication manifest: /unknown',
    )

    // A known manifest route whose artifact escapes the client directory is rejected.
    const unsafeManifest = createPublicationManifest('/', 'ignore', [{
      routePath: '/escape',
      artifact: '../escape',
      output: {
        kind: 'page',
        page: { status: 200, head: '', html: '', enhancements: [], islands: [] },
      },
    }])
    const unsafeOutput = createBuildOutput(clientDirectory, unsafeManifest)
    await expect(unsafeOutput.readText(unsafeManifest.routes[0]!)).rejects.toThrow(
      'output.readText artifact escapes the build output directory: ../escape',
    )
  })

  it('refuses route reads through symlinked output ancestors and files', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'nib-output-read-symlink-'))
    temporaryDirectories.push(root)
    const clientDirectory = path.join(root, 'client')
    const outsideDirectory = path.join(root, 'outside')
    await fs.mkdir(clientDirectory)
    await fs.mkdir(outsideDirectory)
    await fs.writeFile(path.join(outsideDirectory, 'ancestor.txt'), 'outside ancestor')
    await fs.writeFile(path.join(outsideDirectory, 'leaf.txt'), 'outside leaf')
    await fs.symlink(
      outsideDirectory,
      path.join(clientDirectory, 'linked'),
      process.platform === 'win32' ? 'junction' : 'dir',
    )
    await fs.symlink(
      path.join(outsideDirectory, 'leaf.txt'),
      path.join(clientDirectory, 'leaf.txt'),
      'file',
    )
    const manifest = createPublicationManifest('/', 'ignore', [
      {
        routePath: '/ancestor',
        artifact: 'linked/ancestor.txt',
        output: {
          kind: 'resource',
          status: 200,
          body: '',
          contentType: 'text/plain',
        },
      },
      {
        routePath: '/leaf',
        artifact: 'leaf.txt',
        output: {
          kind: 'resource',
          status: 200,
          body: '',
          contentType: 'text/plain',
        },
      },
    ])
    const output = createBuildOutput(clientDirectory, manifest)

    await expect(output.readText(manifest.routes[0]!)).rejects.toThrow(
      'output.readText cannot traverse symbolic links in the build output directory: linked',
    )
    await expect(output.readBytes(manifest.routes[1]!)).rejects.toThrow(
      'output.readBytes cannot traverse symbolic links in the build output directory: leaf.txt',
    )
  })

  it('atomically swaps a staged directory into the client output', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'nib-output-stage-'))
    temporaryDirectories.push(root)
    const clientDirectory = path.join(root, 'client')
    await fs.mkdir(clientDirectory)
    const output = createBuildOutput(
      clientDirectory,
      createPublicationManifest('/', 'ignore', []),
    )

    const first = await output.stageDirectory('pagefind')
    expect(path.dirname(first.path)).toBe(root)
    expect(first.path.startsWith(`${clientDirectory}${path.sep}`)).toBe(false)
    await fs.writeFile(path.join(first.path, 'first.txt'), 'first')
    await first.publishTo('pagefind')
    expect(await fs.readFile(path.join(clientDirectory, 'pagefind/first.txt'), 'utf8'))
      .toBe('first')
    await expect(first.publishTo('pagefind')).rejects.toThrow(
      'staged output "pagefind" can only be published once',
    )

    // A second publish replaces the previous contents wholesale.
    await fs.mkdir(path.join(clientDirectory, 'pagefind.previous'))
    await fs.writeFile(path.join(clientDirectory, 'pagefind.previous/keep.txt'), 'keep')
    const second = await output.stageDirectory('pagefind')
    await fs.writeFile(path.join(second.path, 'second.txt'), 'second')
    await second.publishTo('pagefind')
    expect(await fs.readFile(path.join(clientDirectory, 'pagefind/second.txt'), 'utf8'))
      .toBe('second')
    await expect(fs.readFile(path.join(clientDirectory, 'pagefind/first.txt'), 'utf8'))
      .rejects.toThrow()
    expect(await fs.readFile(path.join(clientDirectory, 'pagefind.previous/keep.txt'), 'utf8'))
      .toBe('keep')
    expect((await fs.readdir(clientDirectory))
      .filter((entry) => entry.startsWith('pagefind.previous-'))).toEqual([])

    // A non-flat stage name is rejected.
    await expect(output.stageDirectory('pagefind/sub')).rejects.toThrow(
      'output.stageDirectory name must be a flat identifier',
    )
  })

  it('serializes concurrent publications to one target without backup collisions', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'nib-output-stage-concurrent-'))
    temporaryDirectories.push(root)
    const clientDirectory = path.join(root, 'client')
    await fs.mkdir(clientDirectory)
    const session = createBuildOutputSession(
      clientDirectory,
      createPublicationManifest('/', 'ignore', []),
    )
    const first = await session.output.stageDirectory('first')
    const second = await session.output.stageDirectory('second')
    await fs.writeFile(path.join(first.path, 'value.txt'), 'first')
    await fs.writeFile(path.join(second.path, 'value.txt'), 'second')

    await Promise.all([
      first.publishTo('generated'),
      second.publishTo('generated'),
    ])
    await session.complete()

    expect(await fs.readFile(path.join(clientDirectory, 'generated/value.txt'), 'utf8'))
      .toBe('second')
    expect((await fs.readdir(clientDirectory))
      .filter((entry) => entry.startsWith('generated.previous-'))).toEqual([])
  })

  it('restores the prior directory when staged publication fails', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'nib-output-stage-rollback-'))
    temporaryDirectories.push(root)
    const clientDirectory = path.join(root, 'client')
    await fs.mkdir(path.join(clientDirectory, 'generated'), { recursive: true })
    await fs.writeFile(path.join(clientDirectory, 'generated/value.txt'), 'original')
    const session = createBuildOutputSession(
      clientDirectory,
      createPublicationManifest('/', 'ignore', []),
    )
    const stage = await session.output.stageDirectory('rollback')
    await fs.writeFile(path.join(stage.path, 'value.txt'), 'replacement')
    await fs.rm(stage.path, { recursive: true, force: true })

    await expect(stage.publishTo('generated')).rejects.toThrow()
    await expect(session.complete()).rejects.toThrow()
    expect(await fs.readFile(path.join(clientDirectory, 'generated/value.txt'), 'utf8'))
      .toBe('original')
    expect((await fs.readdir(clientDirectory))
      .filter((entry) => entry.startsWith('generated.previous-'))).toEqual([])
  })

  it('refuses staged publication through a symlinked output parent', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'nib-output-stage-symlink-'))
    temporaryDirectories.push(root)
    const clientDirectory = path.join(root, 'client')
    const outsideDirectory = path.join(root, 'outside')
    await fs.mkdir(clientDirectory)
    await fs.mkdir(outsideDirectory)
    await fs.writeFile(path.join(outsideDirectory, 'keep.txt'), 'untouched')
    await fs.symlink(
      outsideDirectory,
      path.join(clientDirectory, 'generated'),
      process.platform === 'win32' ? 'junction' : 'dir',
    )
    const session = createBuildOutputSession(
      clientDirectory,
      createPublicationManifest('/', 'ignore', []),
    )
    const stage = await session.output.stageDirectory('symlink-escape')
    await fs.writeFile(path.join(stage.path, 'replacement.txt'), 'must stay contained')

    await expect(stage.publishTo('generated/search')).rejects.toThrow(
      'staged output target cannot traverse symbolic links in the build output directory: generated',
    )
    await expect(session.complete()).rejects.toThrow(
      'staged output target cannot traverse symbolic links in the build output directory: generated',
    )
    expect(await fs.readFile(path.join(outsideDirectory, 'keep.txt'), 'utf8')).toBe('untouched')
    await expect(fs.access(path.join(outsideDirectory, 'search'))).rejects.toThrow()
    expect((await fs.lstat(path.join(clientDirectory, 'generated'))).isSymbolicLink()).toBe(true)
    await expect(fs.access(stage.path)).rejects.toThrow()
  })

  it('waits for unawaited stage creation and removes the resulting unpublished stage', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'nib-output-stage-late-'))
    temporaryDirectories.push(root)
    const clientDirectory = path.join(root, 'client')
    await fs.mkdir(clientDirectory)
    const session = createBuildOutputSession(
      clientDirectory,
      createPublicationManifest('/', 'ignore', []),
    )

    const pendingStage = session.output.stageDirectory('late')
    const completion = session.complete()
    const stage = await pendingStage

    await expect(completion).rejects.toThrow(
      'Nib finalizers left unpublished staged output: "late"',
    )
    await expect(fs.access(stage.path)).rejects.toThrow()
  })

  it('waits for writes already in progress before completing', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'nib-output-write-finalize-'))
    temporaryDirectories.push(root)
    const clientDirectory = path.join(root, 'client')
    await fs.mkdir(clientDirectory)
    const session = createBuildOutputSession(
      clientDirectory,
      createPublicationManifest('/', 'ignore', []),
    )
    const body = new Uint8Array(1024 * 1024).fill(42)

    const write = session.output.write('generated/value.bin', body)
    await Promise.all([write, session.complete()])

    expect((await fs.stat(path.join(clientDirectory, 'generated/value.bin'))).size).toBe(body.length)
  })

  it('reports fire-and-forget operation failures that settled before completion', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'nib-output-early-failures-'))
    temporaryDirectories.push(root)
    const clientDirectory = path.join(root, 'client')
    await fs.mkdir(clientDirectory)

    const failedWriteSession = createBuildOutputSession(
      clientDirectory,
      createPublicationManifest('/', 'ignore', []),
    )
    void failedWriteSession.output.write('../escape.txt', 'escape')
    await new Promise<void>((resolve) => setImmediate(resolve))
    await expect(failedWriteSession.complete()).rejects.toThrow(
      'output.write artifact escapes the build output directory: ../escape.txt',
    )

    const failedStageSession = createBuildOutputSession(
      clientDirectory,
      createPublicationManifest('/', 'ignore', []),
    )
    void failedStageSession.output.stageDirectory('invalid/name')
    await new Promise<void>((resolve) => setImmediate(resolve))
    await expect(failedStageSession.complete()).rejects.toThrow(
      'output.stageDirectory name must be a flat identifier',
    )
    await expect(fs.access(path.join(root, 'escape.txt'))).rejects.toThrow()
  })

  it('closes every output operation after completion or abort', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'nib-output-closed-'))
    temporaryDirectories.push(root)
    const clientDirectory = path.join(root, 'client')
    await fs.mkdir(clientDirectory)
    const manifest = createPublicationManifest('/', 'ignore', [{
      routePath: '/known',
      artifact: 'known.txt',
      output: { kind: 'resource', status: 200, body: '', contentType: 'text/plain' },
    }])
    const route = manifest.routes[0]!

    const completed = createBuildOutputSession(clientDirectory, manifest)
    await completed.complete()
    await expectOutputSessionClosed(completed, route)
    // Project finalization invokes abort after a failed complete; cleanup is idempotent.
    await expect(completed.abort()).resolves.toBeUndefined()

    const aborted = createBuildOutputSession(clientDirectory, manifest)
    const stage = await aborted.output.stageDirectory('before-abort')
    await aborted.abort()
    await expectOutputSessionClosed(aborted, route)
    await expect(stage.publishTo('published-too-late')).rejects.toThrow('starts closing')
    await expect(fs.access(stage.path)).rejects.toThrow()
    await expect(aborted.abort()).resolves.toBeUndefined()
    await expect(aborted.complete()).rejects.toThrow('cannot complete more than once')
    await expect(fs.access(path.join(clientDirectory, 'late.txt'))).rejects.toThrow()
  })
})

describe('finalize context', () => {
  it('exposes output.write and readCollection to plugin finalize hooks', async () => {
    const posts = defineCollection({
      loader: async () => [{ id: 'one', data: { title: 'One' } }],
      validate: (value) => value as { title: string },
    })
    const titles = fromCollection(posts, (entries) => (
      entries.map((entry) => entry.data.title)
    ))
    const clientDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'nib-finalize-output-'))
    temporaryDirectories.push(clientDirectory)

    const observed: { titles: unknown; hasOutput: boolean } = { titles: null, hasOutput: false }
    const writer = definePlugin({
      name: 'finalize-writer',
      renderer() {
        return {
          async finalize(context) {
            // readCollection is present and functional on NibFinalizeContext.
            observed.titles = context.readCollection(titles)
            // output is present and functional on NibFinalizeContext.
            observed.hasOutput = typeof context.output.write === 'function'
            await context.output.write('computed/titles.json', JSON.stringify(observed.titles))
          },
        }
      },
    })
    const renderer = await createProjectRenderer({
      config: { collections: { posts }, plugins: [writer] },
      root: process.cwd(),
      base: '/',
      pages: {},
    })

    await renderer.finalize({
      clientDirectory,
      publication: createPublicationManifest('/', 'ignore', []),
    })

    expect(observed.hasOutput).toBe(true)
    expect(observed.titles).toEqual(['One'])
    expect(await fs.readFile(path.join(clientDirectory, 'computed/titles.json'), 'utf8'))
      .toBe('["One"]')
  })

  it('fails finalization and removes a stage that a plugin did not publish', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'nib-finalize-unpublished-'))
    temporaryDirectories.push(root)
    const clientDirectory = path.join(root, 'client')
    await fs.mkdir(clientDirectory)
    let stagedPath = ''
    const forgetful = definePlugin({
      name: 'forgetful-finalizer',
      renderer() {
        return {
          async finalize(context) {
            const stage = await context.output.stageDirectory('forgotten')
            stagedPath = stage.path
            await fs.writeFile(path.join(stage.path, 'private.txt'), 'must not ship')
          },
        }
      },
    })
    const renderer = await createProjectRenderer({
      config: { plugins: [forgetful] },
      root,
      base: '/',
      pages: {},
    })

    await expect(renderer.finalize({
      clientDirectory,
      publication: createPublicationManifest('/', 'ignore', []),
    })).rejects.toThrow('Nib finalizers left unpublished staged output: "forgotten"')
    expect(stagedPath).not.toBe('')
    await expect(fs.access(stagedPath)).rejects.toThrow()
    expect((await fs.readdir(clientDirectory)).some((entry) => entry.includes('forgotten')))
      .toBe(false)
  })
})
