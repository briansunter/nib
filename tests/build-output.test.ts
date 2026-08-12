import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { createBuildOutput } from '../src/framework/build-output'
import { defineCollection, fromCollection } from '../src/framework/content'
import { definePlugin } from '../src/framework/plugin'
import { createProjectRenderer } from '../src/framework/project-renderer'
import { createPublicationManifest } from '../src/framework/publication'

const temporaryDirectories: string[] = []

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => (
    fs.rm(directory, { recursive: true, force: true })
  )))
})

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

    // A route whose artifact escapes the client directory is rejected.
    await expect(output.readText({ ...route, path: '/escape', artifact: '../escape' }))
      .rejects.toThrow(
        'output.readText artifact escapes the build output directory: ../escape',
      )
  })

  it('atomically swaps a staged directory into the client output', async () => {
    const clientDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'nib-output-stage-'))
    temporaryDirectories.push(clientDirectory)
    const output = createBuildOutput(
      clientDirectory,
      createPublicationManifest('/', 'ignore', []),
    )

    const first = await output.stageDirectory('pagefind')
    expect(first.path.startsWith(clientDirectory)).toBe(true)
    await fs.writeFile(path.join(first.path, 'first.txt'), 'first')
    await first.publishTo('pagefind')
    expect(await fs.readFile(path.join(clientDirectory, 'pagefind/first.txt'), 'utf8'))
      .toBe('first')

    // A second publish replaces the previous contents wholesale.
    const second = await output.stageDirectory('pagefind')
    await fs.writeFile(path.join(second.path, 'second.txt'), 'second')
    await second.publishTo('pagefind')
    expect(await fs.readFile(path.join(clientDirectory, 'pagefind/second.txt'), 'utf8'))
      .toBe('second')
    await expect(fs.readFile(path.join(clientDirectory, 'pagefind/first.txt'), 'utf8'))
      .rejects.toThrow()

    // A non-flat stage name is rejected.
    await expect(output.stageDirectory('pagefind/sub')).rejects.toThrow(
      'output.stageDirectory name must be a flat identifier',
    )
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
})
