import path from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  NIB_CLIENT_ENTRY,
  NIB_BEHAVIOR_ENTRY,
  NIB_ENHANCEMENT_ENTRY,
  NIB_SERVER_ENTRY,
  nibProject,
} from '../src/framework/project-vite-plugin'

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
    expect(behavior).toContain("import.meta.glob('/src/behaviors/**/*.client.{ts,tsx}')")
    expect(behavior).toContain('createBehaviorRuntime')
    expect(behavior).toContain('@briansunter/nib/client/behaviors')
    expect(server).toContain(path.resolve('/site/nib.config.ts'))
    expect(server).toContain('"/src/pages/**/page.tsx"')
    expect(server).toContain('"/src/pages/**/page.yaml"')
    expect(server).toContain('"/src/content/projects.json"')
    expect(server).toContain("query: '?nib-page-source'")
    expect(server).toContain("import.meta.glob('/src/pages/**/layout.tsx'")
    expect(server).toContain('createProjectRenderer')
    expect(server).toContain('root: "/site"')
    expect(server).toContain('command: "serve"')
    expect(server).toContain('export const finalize = renderer.finalize')
    expect(server).toContain('@briansunter/nib/internal/server')
    expect(resolve('other')).toBeNull()
    expect(resolve(NIB_ENHANCEMENT_ENTRY)).toBeNull()
    expect(load('other')).toBeNull()
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
      '__nibRegisterClientCleanup(__nibClientInitializer0())',
      'if (import.meta.hot) import.meta.hot.dispose(() => {',
      '  const failures = []',
      '  for (const cleanup of __nibClientCleanups.reverse()) {',
      '    try { cleanup() } catch (error) { failures.push(error) }',
      '  }',
      `  if (failures.length > 0) throw new AggregateError(failures, 'Nib client enhancement cleanup failed')`,
      '})',
    ].join('\n'))
  })
})
