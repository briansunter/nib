import { describe, expect, it } from 'vitest'
import { islandFileToId, validateIslandId } from '../src/framework/island-paths'

describe('island paths', () => {
  it('maps island files to stable IDs', () => {
    expect(islandFileToId('./islands/counter.tsx')).toBe('counter')
    expect(islandFileToId('/src/islands/cart/summary.tsx')).toBe('cart/summary')
    expect(islandFileToId('C:\\site\\src\\islands\\quantity-picker.tsx?import')).toBe('quantity-picker')
  })

  it('normalizes and validates explicit IDs', () => {
    expect(validateIslandId('/cart/summary/')).toBe('cart/summary')
    expect(() => validateIslandId('Cart/Summary')).toThrow('Invalid island ID')
    expect(() => validateIslandId('cart_widget')).toThrow('Invalid island ID')
    expect(() => islandFileToId('./components/counter.tsx')).toThrow('Invalid island file')
  })
})
