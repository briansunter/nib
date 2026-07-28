import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

const fixturesDirectory = path.resolve('tests/fixtures')
const repositoryRoot = path.resolve('.')
const repositoryModules = path.join(repositoryRoot, 'node_modules')

async function linkDirectoryEntries(
  sourceDirectory: string,
  targetDirectory: string,
): Promise<void> {
  await fs.mkdir(targetDirectory, { recursive: true })
  const entries = await fs.readdir(sourceDirectory, { withFileTypes: true })
  await Promise.all(entries.map(async (entry) => {
    const source = path.join(sourceDirectory, entry.name)
    const target = path.join(targetDirectory, entry.name)
    if (entry.name.startsWith('@') && entry.isDirectory()) {
      await linkDirectoryEntries(source, target)
      return
    }
    await fs.symlink(source, target, entry.isDirectory() ? 'dir' : 'file')
  }))
}

async function linkRepositoryDependencies(root: string): Promise<void> {
  const modules = path.join(root, 'node_modules')
  await linkDirectoryEntries(repositoryModules, modules)
  const scope = path.join(modules, '@briansunter')
  const frameworkLink = path.join(scope, 'nib')
  await fs.mkdir(scope, { recursive: true })
  await fs.rm(frameworkLink, { recursive: true, force: true })
  await fs.symlink(repositoryRoot, frameworkLink, 'dir')
}

/** Copies a checked-in fixture to an isolated temporary project directory. */
export async function copyFixture(
  name: string,
  prefix = `nib-${name}-`,
): Promise<string> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), prefix))
  await fs.cp(path.join(fixturesDirectory, name), root, { recursive: true })
  const manifest = path.join(root, 'package.json')
  try {
    await fs.access(manifest)
  } catch {
    await fs.writeFile(manifest, `${JSON.stringify({
      name: `nib-test-${name}`,
      private: true,
      type: 'module',
    }, null, 2)}\n`)
  }
  await linkRepositoryDependencies(root)
  return root
}

export async function removeFixture(root: string | undefined): Promise<void> {
  if (root === undefined) return
  await fs.rm(root, { recursive: true, force: true })
}
