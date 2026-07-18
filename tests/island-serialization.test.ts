import { describe, expect, it } from 'vitest'
import { parseIslandProps, serializeIslandProps } from '../src/framework/island-serialization'

describe('island prop serialization', () => {
  it('round trips nested JSON props', () => {
    const props = {
      count: 2,
      enabled: true,
      label: '<Add & continue>',
      values: [1, null, { selected: false }],
    }
    expect(parseIslandProps(serializeIslandProps(props))).toEqual(props)
  })

  it('rejects values that do not survive a JSON round trip', () => {
    const cycle: Record<string, unknown> = {}
    cycle.self = cycle
    const sparse = Array(1)

    expect(() => serializeIslandProps({ value: undefined })).toThrow('cannot be undefined')
    expect(() => serializeIslandProps({ value: Number.NaN })).toThrow('finite JSON number')
    expect(() => serializeIslandProps({ value: -0 })).toThrow('finite JSON number')
    expect(() => serializeIslandProps({ value: 1n })).toThrow('not JSON-serializable')
    expect(() => serializeIslandProps({ value: new Date() })).toThrow('plain object')
    expect(() => serializeIslandProps({ value: sparse })).toThrow('sparse arrays')
    expect(() => serializeIslandProps(cycle)).toThrow('contains a cycle')
  })

  it('rejects invalid serialized input and non-object roots', () => {
    expect(() => parseIslandProps('{')).toThrow('invalid JSON')
    expect(() => parseIslandProps('[]')).toThrow('plain object')
  })
})
