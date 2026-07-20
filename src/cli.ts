import fs from 'node:fs/promises'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { scaffoldSite } from './scaffold'
import { buildSite, previewSite, startDevSite } from './framework/site'

interface PackageManifest {
  version: string
}

export interface CliEnvironment {
  cwd?: string
  environment?: NodeJS.ProcessEnv
  write?: (message: string) => void
}

function option(args: string[], name: string): string | undefined {
  const index = args.indexOf(name)
  return index >= 0 ? args[index + 1] : undefined
}

function options(args: string[], name: string): string[] {
  const values: string[] = []
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] !== name) continue
    const value = args[index + 1]
    if (value === undefined || value.startsWith('--')) {
      throw new Error(`${name} requires a value`)
    }
    values.push(value)
    index += 1
  }
  return values
}

function positional(args: string[]): string[] {
  const values: string[] = []
  for (let index = 0; index < args.length; index += 1) {
    if (args[index].startsWith('--')) {
      if (args[index] !== '--no-install') index += 1
      continue
    }
    values.push(args[index])
  }
  return values
}

async function packageRoot(start: string): Promise<string> {
  let current = start
  while (true) {
    try {
      const manifest = JSON.parse(
        await fs.readFile(path.join(current, 'package.json'), 'utf8'),
      ) as { name?: string }
      if (manifest.name === '@briansunter/nib') return current
    } catch {
      // Continue to the parent.
    }
    const parent = path.dirname(current)
    if (parent === current) throw new Error('Could not locate the Nib package')
    current = parent
  }
}

function packageManager(environment: NodeJS.ProcessEnv): 'bun' | 'npm' | 'pnpm' {
  const agent = environment.npm_config_user_agent ?? ''
  if (agent.startsWith('bun/')) return 'bun'
  if (agent.startsWith('pnpm/')) return 'pnpm'
  return 'npm'
}

async function installDependencies(
  cwd: string,
  manager: ReturnType<typeof packageManager>,
): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const child = spawn(manager, ['install'], { cwd, stdio: 'inherit' })
    child.once('error', reject)
    child.once('exit', (code, signal) => {
      if (code === 0) {
        resolve()
      } else {
        reject(new Error(`${manager} install failed (${signal ?? code ?? 'unknown'})`))
      }
    })
  })
}

function numericOption(args: string[], name: string): number | undefined {
  const value = option(args, name)
  if (value === undefined) return undefined
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 65_535) {
    throw new Error(`${name} must be a port between 1 and 65535`)
  }
  return parsed
}

function help(): string {
  return `Nib

Usage:
  nib init [directory] [--no-install]
  nib dev [--root directory] [--host host] [--port port] [--allowed-host host]
  nib build [--root directory]
  nib preview [--root directory] [--host host] [--port port] [--allowed-host host]`
}

export async function runCli(
  args: string[],
  environment: CliEnvironment = {},
): Promise<number> {
  const cwd = path.resolve(environment.cwd ?? process.cwd())
  const env = environment.environment ?? process.env
  const write = environment.write ?? console.log
  const [command, ...commandArgs] = args

  if (!command || command === 'help' || command === '--help' || command === '-h') {
    write(help())
    return 0
  }

  if (command === 'init') {
    const root = await packageRoot(path.dirname(fileURLToPath(import.meta.url)))
    const manifest = JSON.parse(
      await fs.readFile(path.join(root, 'package.json'), 'utf8'),
    ) as PackageManifest
    const [directory = '.'] = positional(commandArgs)
    const target = path.resolve(cwd, directory)
    await scaffoldSite({
      target,
      packageVersion: manifest.version,
      templateDirectory: path.join(root, 'templates/default'),
    })
    write(`Created ${path.relative(cwd, target) || '.'}`)
    if (!commandArgs.includes('--no-install')) {
      const manager = packageManager(env)
      write(`Installing dependencies with ${manager}…`)
      await installDependencies(target, manager)
      write(`Run: cd ${path.relative(cwd, target) || '.'} && ${manager} run dev`)
    } else {
      write(`Run: cd ${path.relative(cwd, target) || '.'} && npm install && npm run dev`)
    }
    return 0
  }

  const root = path.resolve(cwd, option(commandArgs, '--root') ?? '.')
  if (command === 'build') {
    await buildSite({ root })
    write(`Built ${path.join(root, 'dist/client')}`)
    return 0
  }
  if (command === 'dev') {
    const host = option(commandArgs, '--host')
    const port = numericOption(commandArgs, '--port')
    const allowedHosts = options(commandArgs, '--allowed-host')
    const server = await startDevSite({
      root,
      ...(host === undefined ? {} : { host }),
      ...(port === undefined ? {} : { port }),
      ...(allowedHosts.length === 0 ? {} : { allowedHosts }),
    })
    server.printUrls()
    return 0
  }
  if (command === 'preview') {
    const host = option(commandArgs, '--host')
    const port = numericOption(commandArgs, '--port')
    const allowedHosts = options(commandArgs, '--allowed-host')
    const server = await previewSite({
      root,
      ...(host === undefined ? {} : { host }),
      ...(port === undefined ? {} : { port }),
      ...(allowedHosts.length === 0 ? {} : { allowedHosts }),
    })
    server.printUrls()
    return 0
  }

  throw new Error(`Unknown Nib command: ${command}\n\n${help()}`)
}
