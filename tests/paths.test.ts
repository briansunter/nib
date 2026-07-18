import { describe, expect, it } from 'vitest'
import { fileToRoute, normalizePath, outputPath } from '../src/framework/paths'

describe('paths', () => {
  it('normalizes URLs and trailing slashes', () => {
    expect(normalizePath('/about/?x=1')).toBe('/about')
    expect(normalizePath('/')).toBe('/')
  })
  it('maps page files to routes', () => {
    expect(fileToRoute('../pages/page.tsx')).toBe('/')
    expect(fileToRoute('../pages/docs/start/page.md')).toBe('/docs/start')
    expect(fileToRoute('C:\\app\\pages\\about\\page.tsx')).toBe('/about')
  })
  it('rejects invalid files', () => expect(() => fileToRoute('about.tsx')).toThrow())
  it('maps routes to clean output paths', () => {
    expect(outputPath('/')).toBe('index.html')
    expect(outputPath('/about')).toBe('about/index.html')
  })
})
