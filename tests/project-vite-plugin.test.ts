import path from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  NIB_CLIENT_ENTRY,
  NIB_BEHAVIOR_ENTRY,
  NIB_ENHANCEMENT_ENTRY,
  NIB_SERVER_ENTRY,
  nibProject,
} from '../src/framework/project-vite-plugin'

function runVirtualRuntimeEntry(source: string): {
  events: string[]
  dispose(): void
} {
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
  const registerClientRuntime = (received: unknown) => {
    expect(received).toBe(runtime)
    events.push('register')
    return () => events.push('unregister')
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
    'createIslandRuntime',
    'createBehaviorRuntime',
    'registerClientRuntime',
    'discoverModules',
    'document',
    'hot',
    executable,
  )
  execute(
    createRuntime,
    createRuntime,
    registerClientRuntime,
    () => modules,
    root,
    hot,
  )
  return {
    events,
    dispose() {
      if (!disposeCallback) throw new Error('Virtual entry did not register an HMR disposer')
      disposeCallback()
    },
  }
}

describe('consumer project Vite adapter', () => {
  it('provides framework-owned virtual entries for consumer routes and islands', () => {
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
    const clientId = resolve(NIB_CLIENT_ENTRY)
    const behaviorId = resolve(NIB_BEHAVIOR_ENTRY)
    const serverId = resolve(NIB_SERVER_ENTRY)
    if (!clientId || !behaviorId || !serverId) throw new Error('Nib virtual entries did not resolve')

    const client = load(clientId)
    const behavior = load(behaviorId)
    const server = load(serverId)
    expect(client).toContain("import.meta.glob('/src/islands/**/*.tsx')")
    expect(client).toContain('@briansunter/nib/client/islands')
    expect(client).toContain('createIslandRuntime')
    expect(client).not.toContain('__nibStartIslandRuntime')
    expect(behavior).toContain(
      'import.meta.glob("/src/**/*.client.{js,jsx,mjs,cjs,ts,tsx,mts,cts}")',
    )
    expect(behavior).toContain('createBehaviorRuntime')
    expect(behavior).toContain('@briansunter/nib/client/behaviors')
    expect(server).toContain(path.resolve('/site/nib.config.ts'))
    expect(server).toContain('"/src/pages/**/page.tsx"')
    expect(server).toContain('"/src/pages/**/page.yaml"')
    expect(server).toContain('"/src/content/projects.json"')
    expect(server).toContain("query: '?nib-page-source'")
    expect(server).toContain("import.meta.glob('/src/pages/**/layout.tsx'")
    expect(server).toContain(
      'Object.keys(import.meta.glob("/src/**/*.client.{js,jsx,mjs,cjs,ts,tsx,mts,cts}"))',
    )
    expect(server).toContain('createProjectRenderer')
    expect(server).toContain('root: "/site"')
    expect(server).toContain('command: "serve"')
    expect(server).toContain('behaviorClientFiles,')
    expect(server).toContain('export const finalize = renderer.finalize')
    expect(server).toContain('@briansunter/nib/internal/server')
    expect(resolve('other')).toBeNull()
    expect(resolve(NIB_ENHANCEMENT_ENTRY)).toBeNull()
    expect(load('other')).toBeNull()
  })

  it('unregisters and destroys island and behavior runtimes during HMR disposal', () => {
    const plugin = nibProject('/site/nib.config.ts')
    if (typeof plugin.resolveId !== 'function' || typeof plugin.load !== 'function') {
      throw new Error('Nib project plugin is missing virtual module hooks')
    }
    const resolve = plugin.resolveId as (id: string) => string | null
    const load = plugin.load as (id: string) => string | null

    for (const entry of [NIB_CLIENT_ENTRY, NIB_BEHAVIOR_ENTRY]) {
      const resolved = resolve(entry)
      if (!resolved) throw new Error(`Nib virtual entry ${entry} did not resolve`)
      const source = load(resolved)
      if (!source) throw new Error(`Nib virtual entry ${entry} did not load`)
      const execution = runVirtualRuntimeEntry(source)
      expect(execution.events).toEqual(['create', 'register', 'mount'])
      execution.dispose()
      expect(execution.events).toEqual([
        'create',
        'register',
        'mount',
        'unregister',
        'destroy',
      ])
    }
  })

  it('statically imports configured browser initializers into one optional entry', () => {
    const plugin = nibProject(
      '/site/nib.config.ts',
      '/site',
      [],
      'build',
      [],
      [{
        module: '@briansunter/nib/client/navigation',
        initializer: 'startClientNavigation',
      }],
    )
    if (typeof plugin.resolveId !== 'function' || typeof plugin.load !== 'function') {
      throw new Error('Nib project plugin is missing virtual module hooks')
    }
    const resolve = plugin.resolveId as (id: string) => string | null
    const load = plugin.load as (id: string) => string | null
    const entryId = resolve(NIB_ENHANCEMENT_ENTRY)
    if (!entryId) throw new Error('Nib enhancement entry did not resolve')
    expect(load(entryId)).toBe([
      'import { startClientNavigation as __nibClientInitializer0 } from "@briansunter/nib/client/navigation"',
      'const __nibClientCleanups = []',
      "const __nibRegisterClientCleanup = (result) => {",
      "  if (typeof result === 'function') __nibClientCleanups.push(result)",
      "  else if (result && typeof result.destroy === 'function') __nibClientCleanups.push(() => result.destroy())",
      '}',
      'const __nibCleanupClientEnhancements = () => {',
      '  const failures = []',
      '  while (__nibClientCleanups.length > 0) {',
      '    try { __nibClientCleanups.pop()() } catch (error) { failures.push(error) }',
      '  }',
      `  if (failures.length > 0) throw new AggregateError(failures, 'Nib client enhancement cleanup failed')`,
      '}',
      'try {',
      '  __nibRegisterClientCleanup(__nibClientInitializer0())',
      '} catch (error) {',
      '  try {',
      '    __nibCleanupClientEnhancements()',
      '  } catch (cleanupError) {',
      `    throw new AggregateError([error, cleanupError], 'Nib client enhancement initialization failed')`,
      '  }',
      '  throw error',
      '}',
      'if (import.meta.hot) import.meta.hot.dispose(() => {',
      '  __nibCleanupClientEnhancements()',
      '})',
    ].join('\n'))
  })

  it('rolls back initialized enhancements in reverse order when startup fails', () => {
    const plugin = nibProject(
      '/site/nib.config.ts',
      '/site',
      [],
      'build',
      [],
      [
        { module: 'first', initializer: 'startFirst' },
        { module: 'second', initializer: 'startSecond' },
        { module: 'third', initializer: 'startThird' },
      ],
    )
    if (typeof plugin.resolveId !== 'function' || typeof plugin.load !== 'function') {
      throw new Error('Nib project plugin is missing virtual module hooks')
    }
    const resolve = plugin.resolveId as (id: string) => string | null
    const load = plugin.load as (id: string) => string | null
    const entryId = resolve(NIB_ENHANCEMENT_ENTRY)
    if (!entryId) throw new Error('Nib enhancement entry did not resolve')
    const source = load(entryId)
    if (!source) throw new Error('Nib enhancement entry did not load')

    const events: string[] = []
    const startupError = new Error('third initializer failed')
    let disposeCallback: (() => void) | undefined
    const execute = new Function(
      '__nibClientInitializer0',
      '__nibClientInitializer1',
      '__nibClientInitializer2',
      'hot',
      source
        .replace(/^import[^\n]*\n/gm, '')
        .replaceAll('import.meta.hot', 'hot'),
    )

    let thrown: unknown
    try {
      execute(
        () => {
          events.push('start:first')
          return () => events.push('cleanup:first')
        },
        () => {
          events.push('start:second')
          return { destroy: () => events.push('cleanup:second') }
        },
        () => {
          events.push('start:third')
          throw startupError
        },
        {
          dispose(callback: () => void) {
            disposeCallback = callback
          },
        },
      )
    } catch (error) {
      thrown = error
    }

    expect(thrown).toBe(startupError)
    expect(events).toEqual([
      'start:first',
      'start:second',
      'start:third',
      'cleanup:second',
      'cleanup:first',
    ])
    expect(disposeCallback).toBeUndefined()
  })
})
