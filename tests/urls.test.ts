import { describe, expect, it } from 'vitest'
import { siteHref, stripBasePath } from '../src/framework/urls'

describe('urls', () => {
  it('strips a project Pages base path before route matching', () => {
    expect(stripBasePath('/nib/', '/nib/')).toBe('/')
    expect(stripBasePath('/nib/docs/', '/nib/')).toBe('/docs/')
  })

  it('leaves root and unrelated paths unchanged', () => {
    expect(stripBasePath('/docs/', '/')).toBe('/docs/')
    expect(stripBasePath('/other/', '/nib/')).toBe('/other/')
  })

  it('builds links from the Vite base URL', () => {
    expect(siteHref('/docs/')).toBe('/docs/')
  })
})
