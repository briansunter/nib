import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { build, createServer, type Plugin } from 'vite'
import { describe, expect, it } from 'vitest'
import { cleanModuleId, moduleTarget } from '../src/framework/module-target'
import { targetBoundaryGuard } from '../src/framework/target-boundary'

const fixtureRoot = fileURLToPath(new URL('./fixtures/target-boundary', import.meta.url))

function resolve(
  target: 'client' | 'server' | 'development',
  source: string,
  importer = '/site/src/pages/page.tsx',
  consumer?: 'client' | 'server',
): unknown {
  const plugin = targetBoundaryGuard(target)
  if (typeof plugin.resolveId !== 'function') throw new Error('Boundary plugin has no resolve hook')
  const context = consumer === undefined
    ? {}
    : { environment: { config: { consumer } } }
  return plugin.resolveId.call(context as never, source, importer, {} as never)
}

function transform(
  target: 'client' | 'server' | 'development',
  id: string,
  consumer?: 'client' | 'server',
): unknown {
  const plugin = targetBoundaryGuard(target)
  if (typeof plugin.transform !== 'function') throw new Error('Boundary plugin has no transform hook')
  const context = consumer === undefined
    ? {}
    : { environment: { config: { consumer } } }
  return plugin.transform.call(context as never, '', id, {} as never)
}

function aliases(): Record<string, string> {
  return {
    '#boundary-client': path.join(fixtureRoot, 'src/browser.client.ts'),
    '#boundary-server': path.join(fixtureRoot, 'src/storage.server.ts'),
  }
}

function resolvedAliasPlugin(): Plugin {
  const resolvedAliases = aliases()
  return {
    name: 'resolved-test-aliases',
    enforce: 'pre',
    resolveId(source) {
      return resolvedAliases[source] ?? null
    },
  }
}

describe('client and server module boundaries', () => {
  it('classifies the supported JavaScript and TypeScript suffixes consistently', () => {
    expect([
      'map.client',
      'map.client.js',
      'map.client.jsx',
      'map.client.mjs',
      'map.client.cjs',
      'map.client.ts',
      'map.client.tsx',
      'map.client.mts',
      'map.client.cts',
    ].map(moduleTarget)).toEqual(Array.from({ length: 9 }, () => 'client'))
    expect(moduleTarget('storage.server.ts?raw')).toBe('server')
    expect(moduleTarget('ordinary.ts')).toBeUndefined()
    expect(cleanModuleId('C:\\site\\map.client.ts?raw#part'))
      .toBe('C:/site/map.client.ts')
  })

  it('rejects server modules from the client graph with an import chain', () => {
    expect(() => resolve('client', '../data/posts.server.ts'))
      .toThrow(/client graph cannot import server-only module:[\s\S]*page\.tsx[\s\S]*posts\.server\.ts/)
  })

  it('rejects client modules from the server graph', () => {
    expect(() => resolve('server', '../enhancements/map/index.client.ts'))
      .toThrow(/server graph cannot import client-only module/)
  })

  it('allows matching targets and the combined development graph', () => {
    expect(resolve('client', '../enhancements/map/index.client.ts')).toBeNull()
    expect(resolve('server', '../data/posts.server.ts')).toBeNull()
    expect(resolve('development', '../enhancements/map/index.client.ts')).toBeNull()
    expect(resolve('development', '../data/posts.server.ts')).toBeNull()
  })

  it('uses the active Vite environment for development graphs', () => {
    expect(() => resolve('development', '../data/posts.server.ts', undefined, 'client'))
      .toThrow(/client graph cannot import server-only module/)
    expect(() => resolve('development', '../enhancements/map/index.client.ts', undefined, 'server'))
      .toThrow(/server graph cannot import client-only module/)
    expect(resolve('development', '../enhancements/map/index.client.ts', undefined, 'client')).toBeNull()
    expect(resolve('development', '../data/posts.server.ts', undefined, 'server')).toBeNull()
  })

  it('checks final resolved module ids after aliases', () => {
    expect(() => transform('client', '/site/src/data/posts.server.ts'))
      .toThrow(/client graph cannot import server-only module/)
    expect(() => transform('server', '/site/src/enhancements/map/index.client.ts'))
      .toThrow(/server graph cannot import client-only module/)
  })

  it('prevents a resolved server alias from entering a real client build', async () => {
    await expect(build({
      configFile: false,
      logLevel: 'silent',
      root: fixtureRoot,
      plugins: [
        targetBoundaryGuard('client'),
        resolvedAliasPlugin(),
      ],
      build: {
        rollupOptions: {
          input: path.join(fixtureRoot, 'src/client-entry.ts'),
        },
        write: false,
      },
    })).rejects.toThrow(/client graph cannot import server-only module:[\s\S]*storage\.server\.ts/)
  })

  it('prevents a resolved client alias from entering a real SSR build', async () => {
    await expect(build({
      configFile: false,
      logLevel: 'silent',
      root: fixtureRoot,
      plugins: [
        targetBoundaryGuard('server'),
        resolvedAliasPlugin(),
      ],
      build: {
        ssr: path.join(fixtureRoot, 'src/server-entry.ts'),
        write: false,
      },
    })).rejects.toThrow(/server graph cannot import client-only module:[\s\S]*browser\.client\.ts/)
  })

  it('enforces both Vite development environments', async () => {
    const vite = await createServer({
      appType: 'custom',
      configFile: false,
      logLevel: 'silent',
      root: fixtureRoot,
      plugins: [
        targetBoundaryGuard('development'),
        resolvedAliasPlugin(),
      ],
      server: {
        middlewareMode: true,
        preTransformRequests: false,
      },
    })
    try {
      await expect(vite.environments.client.transformRequest('/src/storage.server.ts'))
        .rejects.toThrow(/client graph cannot import server-only module/)
      await expect(vite.environments.ssr.transformRequest('/src/browser.client.ts'))
        .rejects.toThrow(/server graph cannot import client-only module/)
    } finally {
      await vite.close()
    }
  })
})
