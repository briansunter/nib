import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { scaffoldSite } from '../src/scaffold'

const temporaryDirectories: string[] = []

async function temporaryDirectory(): Promise<string> {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'nib-scaffold-'))
  temporaryDirectories.push(directory)
  return directory
}

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => (
    fs.rm(directory, { recursive: true, force: true })
  )))
})

describe('site scaffolding', () => {
  it('creates an app that depends on Nib without copying framework internals', async () => {
    const parent = await temporaryDirectory()
    const target = path.join(parent, 'my-site')

    const result = await scaffoldSite({
      target,
      packageVersion: '0.4.0',
      templateDirectory: path.resolve('templates/default'),
    })

    expect(result).toEqual({ target, created: true })
    await expect(fs.readFile(path.join(target, 'nib.config.ts'), 'utf8')).resolves
      .toContain("from '@briansunter/nib'")
    await expect(fs.readFile(path.join(target, '.gitignore'), 'utf8')).resolves
      .toContain('node_modules')
    await expect(fs.stat(path.join(target, 'gitignore'))).rejects.toMatchObject({
      code: 'ENOENT',
    })
    await expect(fs.readFile(path.join(target, 'src/pages/page.tsx'), 'utf8')).resolves
      .toContain("from '@briansunter/nib'")

    const manifest = JSON.parse(
      await fs.readFile(path.join(target, 'package.json'), 'utf8'),
    ) as {
      dependencies: Record<string, string>
      scripts: Record<string, string>
    }
    expect(manifest.dependencies['@briansunter/nib']).toBe('^0.4.0')
    expect((manifest as { name?: string }).name).toBe('my-site')
    expect(manifest.scripts).toMatchObject({
      dev: 'nib dev',
      build: 'nib build',
      preview: 'nib preview',
    })
    await expect(fs.stat(path.join(target, 'src/framework'))).rejects.toMatchObject({
      code: 'ENOENT',
    })
  })

  it('refuses to overwrite an existing project', async () => {
    const target = await temporaryDirectory()
    const existingFile = path.join(target, 'keep.txt')
    await fs.writeFile(existingFile, 'keep me')

    await expect(scaffoldSite({
      target,
      packageVersion: '0.4.0',
      templateDirectory: path.resolve('templates/default'),
    })).rejects.toThrow(`Target directory is not empty: ${target}`)
    await expect(fs.readFile(existingFile, 'utf8')).resolves.toBe('keep me')
  })

  it('can initialize the current empty directory', async () => {
    const target = await temporaryDirectory()
    await scaffoldSite({
      target,
      packageVersion: '0.4.0',
      templateDirectory: path.resolve('templates/default'),
    })
    await expect(fs.readFile(path.join(target, 'nib.config.ts'), 'utf8')).resolves
      .toContain('defineConfig')
    await expect(fs.stat(path.join(target, 'default'))).rejects.toMatchObject({
      code: 'ENOENT',
    })
  })
})
