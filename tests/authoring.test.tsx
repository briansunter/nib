import { describe, expect, it } from 'vitest'
import { defineDataPage, defineLayout, definePage } from '../src/index'

const Page = () => null

describe('typed authoring helpers', () => {
  it('keeps pages, data pages, and layouts identity-only at runtime', () => {
    expect(definePage(Page)).toBe(Page)
    expect(defineDataPage(Page)).toBe(Page)
    expect(defineLayout(Page)).toBe(Page)
  })
})
