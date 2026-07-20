import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { runCli } from '../src/cli'

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
})
