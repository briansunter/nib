import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { execFile, spawn, type ChildProcess } from 'node:child_process'
import { promisify } from 'node:util'
import { afterAll, describe, expect, it } from 'vitest'

const execute = promisify(execFile)
const temporaryDirectories: string[] = []
const children: ChildProcess[] = []

async function temporaryDirectory(name: string): Promise<string> {
  const parent = await fs.mkdtemp(path.join(os.tmpdir(), `${name}-`))
  temporaryDirectories.push(parent)
  return parent
}

async function waitForOutput(child: ChildProcess, pattern: RegExp): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    let output = ''
    const timeout = setTimeout(() => {
      reject(new Error(`Timed out waiting for preview server:\n${output}`))
    }, 20_000)
    const receive = (chunk: Buffer | string) => {
      output += chunk.toString()
      const plainOutput = output.replace(/\u001B\[[0-9;]*m/g, '')
      if (pattern.test(plainOutput)) {
        clearTimeout(timeout)
        resolve()
      }
    }
    child.stdout?.on('data', receive)
    child.stderr?.on('data', receive)
    child.once('error', reject)
    child.once('exit', (code) => {
      clearTimeout(timeout)
      reject(new Error(`Preview server exited with ${String(code)}:\n${output}`))
    })
  })
}

afterAll(async () => {
  for (const child of children.splice(0)) {
    if (!child.killed) child.kill('SIGTERM')
  }
  await Promise.all(temporaryDirectories.splice(0).map((directory) => (
    fs.rm(directory, { recursive: true, force: true })
  )))
})

describe('published package consumer', () => {
  it('installs, scaffolds, typechecks, builds, and previews outside the repository', async () => {
    const packageDirectory = await temporaryDirectory('nib-package')
    const packed = await execute(
      'npm',
      ['pack', '--json', '--pack-destination', packageDirectory],
      { cwd: path.resolve('.') },
    )
    const packResult = JSON.parse(packed.stdout) as Array<{
      filename: string
      files: Array<{ path: string }>
    }>
    const tarball = path.join(packageDirectory, packResult[0].filename)
    const packedFiles = packResult[0].files.map((file) => file.path)

    expect(packedFiles).toContain('bin/nib.js')
    expect(packedFiles).toContain('dist/framework/index.js')
    expect(packedFiles).toContain('dist/framework/index.d.ts')
    expect(packedFiles).toContain('templates/default/nib.config.ts')
    expect(packedFiles).toContain('templates/default/gitignore')
    expect(packedFiles.some((file) => file.startsWith('tests/'))).toBe(false)
    expect(packedFiles.some((file) => file.startsWith('examples/'))).toBe(false)

    const consumerRoot = await temporaryDirectory('nib-consumer')
    const consumerEnvironment = {
      ...process.env,
      GITHUB_ACTIONS: 'false',
      GITHUB_REPOSITORY: '',
    }
    const launcher = path.join(consumerRoot, 'launcher')
    const site = path.join(consumerRoot, 'site')
    await fs.mkdir(launcher)
    await fs.writeFile(
      path.join(launcher, 'package.json'),
      '{"private":true,"type":"module"}\n',
    )
    await execute(
      'npm',
      ['install', '--no-audit', '--no-fund', '--ignore-scripts', tarball],
      { cwd: launcher },
    )

    const nibBin = path.join(launcher, 'node_modules/.bin/nib')
    await execute(
      nibBin,
      ['init', site, '--no-install'],
      { cwd: launcher },
    )
    await execute(
      'npm',
      ['install', '--no-audit', '--no-fund', '--ignore-scripts', tarball],
      { cwd: site },
    )
    await execute('npm', ['run', 'typecheck'], {
      cwd: site,
      env: consumerEnvironment,
    })
    await execute('npm', ['run', 'build'], {
      cwd: site,
      env: consumerEnvironment,
    })

    const home = await fs.readFile(path.join(site, 'dist/client/index.html'), 'utf8')
    const about = await fs.readFile(path.join(site, 'dist/client/about/index.html'), 'utf8')
    expect(home).toContain('Make this site yours')
    expect(home).toContain('data-island="counter"')
    expect(about).toContain('Replace this page with your own content')
    expect(about).not.toContain('data-nib-islands')
    await expect(fs.stat(path.join(site, 'src/framework'))).rejects.toMatchObject({
      code: 'ENOENT',
    })

    const port = 47_000 + (process.pid % 1_000)
    const preview = spawn(
      path.join(site, 'node_modules/.bin/nib'),
      [
        'preview',
        '--host',
        '127.0.0.1',
        '--port',
        String(port),
      ],
      {
        cwd: site,
        env: consumerEnvironment,
        stdio: ['ignore', 'pipe', 'pipe'],
      },
    )
    children.push(preview)
    await waitForOutput(preview, new RegExp(`127\\.0\\.0\\.1:${port}`))

    const response = await fetch(`http://127.0.0.1:${port}/about/`, {
      headers: { connection: 'close' },
    })
    expect(response.status).toBe(200)
    expect(await response.text()).toContain('About this Nib site')
  }, 120_000)
})
