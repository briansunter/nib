import { describe, expect, it, vi } from 'vitest'
import {
  destroyClientRuntimes,
  registerClientRuntime,
  unmountClientRuntimes,
} from '../src/runtime/coordinator'

function controller(overrides: Partial<{
  mount: () => void
  unmount: () => void
  destroy: () => void
}> = {}) {
  return {
    mount: vi.fn(overrides.mount),
    unmount: vi.fn(overrides.unmount),
    destroy: vi.fn(overrides.destroy),
  }
}

describe('client runtime coordinator cleanup', () => {
  it('unmounts and destroys runtimes in reverse registration order', () => {
    const calls: string[] = []
    const first = controller({
      unmount: () => calls.push('first:unmount'),
      destroy: () => calls.push('first:destroy'),
    })
    const second = controller({
      unmount: () => calls.push('second:unmount'),
      destroy: () => calls.push('second:destroy'),
    })
    registerClientRuntime(first)
    registerClientRuntime(second)

    unmountClientRuntimes({} as ParentNode)
    destroyClientRuntimes()

    expect(calls).toEqual([
      'second:unmount',
      'first:unmount',
      'second:destroy',
      'first:destroy',
    ])
  })

  it('attempts every unmount before throwing an aggregate error', () => {
    const first = controller({ unmount: () => { throw new Error('first') } })
    const second = controller()
    const unregisterFirst = registerClientRuntime(first)
    const unregisterSecond = registerClientRuntime(second)
    try {
      expect(() => unmountClientRuntimes({} as ParentNode)).toThrow(AggregateError)
      expect(first.unmount).toHaveBeenCalledOnce()
      expect(second.unmount).toHaveBeenCalledOnce()
    } finally {
      unregisterFirst()
      unregisterSecond()
    }
  })

  it('clears registration and attempts every destroy after a failure', () => {
    const first = controller({ destroy: () => { throw new Error('first') } })
    const second = controller()
    registerClientRuntime(first)
    registerClientRuntime(second)

    expect(() => destroyClientRuntimes()).toThrow(AggregateError)
    expect(first.destroy).toHaveBeenCalledOnce()
    expect(second.destroy).toHaveBeenCalledOnce()
    expect(() => destroyClientRuntimes()).not.toThrow()
  })
})
