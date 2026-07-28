import { describe, expect, it } from 'vitest'
import { targetBoundaryGuard } from '../src/framework/target-boundary'

function resolve(
  target: 'client' | 'server' | 'development',
  source: string,
  importer = '/site/src/pages/page.tsx',
): unknown {
  const plugin = targetBoundaryGuard(target)
  if (typeof plugin.resolveId !== 'function') throw new Error('Boundary plugin has no resolve hook')
  return plugin.resolveId.call({} as never, source, importer, {} as never)
}

describe('client and server module boundaries', () => {
  it('rejects server modules from the client graph with an import chain', () => {
    expect(() => resolve('client', '../data/posts.server.ts'))
      .toThrow(/client graph cannot import server-only module:[\s\S]*page\.tsx[\s\S]*posts\.server\.ts/)
  })

  it('rejects client modules from the server graph', () => {
    expect(() => resolve('server', '../behaviors/map.client.ts'))
      .toThrow(/server graph cannot import client-only module/)
  })

  it('allows matching targets and the combined development graph', () => {
    expect(resolve('client', '../behaviors/map.client.ts')).toBeNull()
    expect(resolve('server', '../data/posts.server.ts')).toBeNull()
    expect(resolve('development', '../behaviors/map.client.ts')).toBeNull()
    expect(resolve('development', '../data/posts.server.ts')).toBeNull()
  })
})
