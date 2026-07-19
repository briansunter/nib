import path from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  NIB_CLIENT_ENTRY,
  NIB_SERVER_ENTRY,
  nibProject,
} from '../src/framework/project-vite-plugin'

describe('consumer project Vite adapter', () => {
  it('provides framework-owned virtual entries for consumer routes and islands', () => {
    const plugin = nibProject('/site/nib.config.ts')
    if (typeof plugin.resolveId !== 'function' || typeof plugin.load !== 'function') {
      throw new Error('Nib project plugin is missing virtual module hooks')
    }
    const resolve = plugin.resolveId as (id: string) => string | null
    const load = plugin.load as (id: string) => string | null
    const clientId = resolve(NIB_CLIENT_ENTRY)
    const serverId = resolve(NIB_SERVER_ENTRY)
    if (!clientId || !serverId) throw new Error('Nib virtual entries did not resolve')

    const client = load(clientId)
    const server = load(serverId)
    expect(client).toContain("import.meta.glob('/src/islands/**/*.tsx')")
    expect(client).toContain('@briansunter/nib/internal/client')
    expect(server).toContain(path.resolve('/site/nib.config.ts'))
    expect(server).toContain("'/src/pages/**/page.tsx'")
    expect(server).toContain('@briansunter/nib/internal/server')
    expect(resolve('other')).toBeNull()
    expect(load('other')).toBeNull()
  })
})
