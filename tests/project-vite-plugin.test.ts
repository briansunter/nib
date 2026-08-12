import path from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  NIB_APP_CLIENT_ENTRY,
  NIB_ENHANCEMENT_ENTRY,
  NIB_ISLAND_ENTRY,
  NIB_SERVER_ENTRY,
  nibProject,
} from '../src/framework/project-vite-plugin'

function runVirtualRuntimeEntry(
  source: string,
  factoryName: 'createEnhancementRuntime' | 'createIslandRuntime',
): { events: string[]; dispose(): void } {
  const events: string[] = []
  const modules = {}
  const root = {}
  const runtime = {
    mount(received: unknown) {
      expect(received).toBe(root)
      events.push('mount')
    },
    destroy() {
      events.push('destroy')
    },
  }
  const createRuntime = (received: unknown) => {
    expect(received).toBe(modules)
    events.push('create')
    return runtime
  }
  let disposeCallback: (() => void) | undefined
  const hot = {
    dispose(callback: () => void) {
      disposeCallback = callback
    },
  }
  const executable = source
    .replace(/^import[^\n]*\n/, '')
    .replace(/import\.meta\.glob\([^\n]*\)/g, 'discoverModules()')
    .replaceAll('import.meta.hot', 'hot')
  const execute = new Function(
    factoryName,
    'discoverModules',
    'document',
    'hot',
    executable,
  )
  execute(createRuntime, () => modules, root, hot)
  return {
    events,
    dispose() {
      if (disposeCallback === undefined) {
        throw new Error('Virtual entry did not register an HMR disposer')
      }
      disposeCallback()
    },
  }
}

describe('consumer project Vite adapter', () => {
  it('provides framework-owned server, enhancement, and island entries', () => {
    const plugin = nibProject(
      '/site/nib.config.ts',
      '/site',
      ['.yaml'],
      'serve',
      ['/src/content/projects.json'],
    )
    if (typeof plugin.resolveId !== 'function' || typeof plugin.load !== 'function') {
      throw new Error('Nib project plugin is missing virtual module hooks')
    }
    const resolve = plugin.resolveId as (id: string) => string | null
    const load = plugin.load as (id: string) => string | null
    const enhancementId = resolve(NIB_ENHANCEMENT_ENTRY)
    const islandId = resolve(NIB_ISLAND_ENTRY)
    const serverId = resolve(NIB_SERVER_ENTRY)
    if (!enhancementId || !islandId || !serverId) {
      throw new Error('Nib virtual entries did not resolve')
    }

    const enhancement = load(enhancementId)
    const island = load(islandId)
    const server = load(serverId)
    expect(enhancement).toContain(
      'import.meta.glob("/src/enhancements/**/index.client.{js,ts}")',
    )
    expect(enhancement).toContain('createEnhancementRuntime')
    expect(enhancement).toContain('@briansunter/nib/internal/enhancements')
    expect(island).toContain('createIslandRuntime')
    expect(island).toContain('@briansunter/nib/internal/islands')
    expect(island).toContain('/src/islands/**/*.tsx')
    expect(server).toContain(path.resolve('/site/nib.config.ts'))
    expect(server).toContain('"/src/pages/**/page.yaml"')
    expect(server).toContain('"/src/content/projects.json"')
    expect(server).toContain("query: '?nib-page-source'")
    expect(server).toContain('enhancementClientFiles,')
    expect(server).toContain('islandModules,')
    expect(server).toContain('command: "serve"')
    expect(server).toContain('export const finalize = renderer.finalize')
    expect(server).toContain('@briansunter/nib/internal/server')
    expect(resolve(NIB_APP_CLIENT_ENTRY)).toBeNull()
    expect(resolve('other')).toBeNull()
    expect(load('other')).toBeNull()
  })

  it.each([
    [NIB_ENHANCEMENT_ENTRY, 'createEnhancementRuntime' as const],
    [NIB_ISLAND_ENTRY, 'createIslandRuntime' as const],
  ])('destroys the %s runtime during HMR disposal', (entry, factoryName) => {
    const plugin = nibProject('/site/nib.config.ts')
    if (typeof plugin.resolveId !== 'function' || typeof plugin.load !== 'function') {
      throw new Error('Nib project plugin is missing virtual module hooks')
    }
    const resolved = (plugin.resolveId as (id: string) => string | null)(entry)
    if (resolved === null) throw new Error('Nib runtime entry did not resolve')
    const source = (plugin.load as (id: string) => string | null)(resolved)
    if (source === null) throw new Error('Nib runtime entry did not load')
    const execution = runVirtualRuntimeEntry(source, factoryName)
    expect(execution.events).toEqual(['create', 'mount'])
    execution.dispose()
    expect(execution.events).toEqual(['create', 'mount', 'destroy'])
  })

  it('auto-imports the optional app client default initializer', () => {
    const plugin = nibProject(
      '/site/nib.config.ts',
      '/site',
      [],
      'build',
      [],
      true,
    )
    if (typeof plugin.resolveId !== 'function' || typeof plugin.load !== 'function') {
      throw new Error('Nib project plugin is missing virtual module hooks')
    }
    const resolve = plugin.resolveId as (id: string) => string | null
    const load = plugin.load as (id: string) => string | null
    const entryId = resolve(NIB_APP_CLIENT_ENTRY)
    if (entryId === null) throw new Error('Nib app client entry did not resolve')
    const source = load(entryId)
    expect(source).toContain("import initialize from '/src/client.ts'")
    expect(source).toContain('initialize(controller.signal)')
    expect(source).toContain('controller.abort()')
  })

  it('aborts the app client signal when synchronous startup fails', () => {
    const plugin = nibProject('/site/nib.config.ts', '/site', [], 'build', [], true)
    if (typeof plugin.resolveId !== 'function' || typeof plugin.load !== 'function') {
      throw new Error('Nib project plugin is missing virtual module hooks')
    }
    const entryId = (plugin.resolveId as (id: string) => string | null)(NIB_APP_CLIENT_ENTRY)
    if (entryId === null) throw new Error('Nib app client entry did not resolve')
    const source = (plugin.load as (id: string) => string | null)(entryId)
    if (source === null) throw new Error('Nib app client entry did not load')

    let received: AbortSignal | undefined
    const startupError = new Error('client failed')
    const execute = new Function(
      'initialize',
      'hot',
      'setTimeout',
      source
        .replace(/^import[^\n]*\n/, '')
        .replaceAll('import.meta.hot', 'hot'),
    )
    expect(() => execute(
      (signal: AbortSignal) => {
        received = signal
        throw startupError
      },
      undefined,
      setTimeout,
    )).toThrow(startupError)
    expect(received?.aborted).toBe(true)
  })

  it('does not report an async cancellation caused by HMR disposal', async () => {
    const plugin = nibProject('/site/nib.config.ts', '/site', [], 'build', [], true)
    if (typeof plugin.resolveId !== 'function' || typeof plugin.load !== 'function') {
      throw new Error('Nib project plugin is missing virtual module hooks')
    }
    const entryId = (plugin.resolveId as (id: string) => string | null)(NIB_APP_CLIENT_ENTRY)
    if (entryId === null) throw new Error('Nib app client entry did not resolve')
    const source = (plugin.load as (id: string) => string | null)(entryId)
    if (source === null) throw new Error('Nib app client entry did not load')

    let dispose: (() => void) | undefined
    let reject: ((error: unknown) => void) | undefined
    const reported: Array<() => void> = []
    const execute = new Function(
      'initialize',
      'hot',
      'setTimeout',
      source
        .replace(/^import[^\n]*\n/, '')
        .replaceAll('import.meta.hot', 'hot'),
    )
    execute(
      () => new Promise<void>((_resolve, rejectPromise) => {
        reject = rejectPromise
      }),
      {
        dispose(callback: () => void) {
          dispose = callback
        },
      },
      (callback: () => void) => {
        reported.push(callback)
      },
    )

    dispose?.()
    reject?.(new DOMException('The operation was aborted', 'AbortError'))
    await Promise.resolve()
    await Promise.resolve()
    expect(reported).toEqual([])
  })
})
