import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { runCli } from '../src/cli'
import { createPublicationManifest } from '../src/framework/publication'

const temporaryDirectories: string[] = []

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => (
    fs.rm(directory, { recursive: true, force: true })
  )))
})

describe('nib command', () => {
  it('documents explicit repeatable host allowlists', async () => {
    const messages: string[] = []

    await expect(runCli(['help'], { write: (message) => messages.push(message) }))
      .resolves.toBe(0)
    expect(messages.join('\n')).toContain('--allowed-host host')
  })

  it('initializes a project through the command users run', async () => {
    const cwd = await fs.mkdtemp(path.join(os.tmpdir(), 'nib-cli-'))
    temporaryDirectories.push(cwd)
    const messages: string[] = []

    const result = await runCli(['init', 'field-notes', '--no-install'], {
      cwd,
      write: (message) => messages.push(message),
    })

    expect(result).toBe(0)
    await expect(fs.readFile(path.join(cwd, 'field-notes/nib.config.ts'), 'utf8'))
      .resolves.toContain('defineConfig')
    expect(messages.join('\n')).toContain('Created')
    expect(messages.join('\n')).toContain('field-notes')
  })

  it('keeps inspect reports distinct from verification', async () => {
    const cwd = await fs.mkdtemp(path.join(os.tmpdir(), 'nib-cli-inspect-'))
    temporaryDirectories.push(cwd)
    const output = path.join(cwd, 'dist/client')
    await fs.mkdir(path.join(output, '.nib'), { recursive: true })
    const manifest = createPublicationManifest('/', 'never', [{
      routePath: '/',
      artifact: 'index.html',
      output: {
        kind: 'page',
        page: { status: 200, head: '', html: '', islands: [], behaviors: [] },
      },
    }])
    await fs.writeFile(
      path.join(output, '.nib/publication.json'),
      JSON.stringify(manifest),
    )
    await fs.writeFile(path.join(output, 'index.html'), '<a href="/missing">Missing</a>')

    const inspectMessages: string[] = []
    await expect(runCli(['inspect', '--json'], {
      cwd,
      write: (message) => inspectMessages.push(message),
    })).resolves.toBe(1)
    const report = JSON.parse(inspectMessages.join('\n')) as {
      output: string
      issues: Array<{ code: string }>
      pages?: unknown
    }
    expect(report.output).toBe('dist/client')
    expect(report.pages).toBeUndefined()
    expect(report.issues.map((issue) => issue.code)).toEqual([
      'LOCAL_REFERENCE_MISSING',
      'TITLE_COUNT',
    ])

    const checkMessages: string[] = []
    await expect(runCli(['check'], {
      cwd,
      write: (message) => checkMessages.push(message),
    })).resolves.toBe(1)
    expect(checkMessages).toHaveLength(2)
    expect(checkMessages[0]).toContain('LOCAL_REFERENCE_MISSING')
  })
})
