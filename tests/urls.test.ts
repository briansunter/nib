import { describe, expect, it } from 'vitest'
import { siteHref, stripBasePath } from '../src/framework/urls'

type BuildGlobals = typeof globalThis & {
  __NIB_BASE_PATH__?: string
  __NIB_TRAILING_SLASH__?: 'always' | 'never' | 'ignore'
}

function withBuildUrlConfig<Value>(
  base: string,
  trailingSlash: 'always' | 'never' | 'ignore',
  callback: () => Value,
): Value {
  const globals = globalThis as BuildGlobals
  const previousBase = globals.__NIB_BASE_PATH__
  const previousTrailingSlash = globals.__NIB_TRAILING_SLASH__
  globals.__NIB_BASE_PATH__ = base
  globals.__NIB_TRAILING_SLASH__ = trailingSlash
  try {
    return callback()
  } finally {
    if (previousBase === undefined) delete globals.__NIB_BASE_PATH__
    else globals.__NIB_BASE_PATH__ = previousBase
    if (previousTrailingSlash === undefined) delete globals.__NIB_TRAILING_SLASH__
    else globals.__NIB_TRAILING_SLASH__ = previousTrailingSlash
  }
}

describe('urls', () => {
  it('strips a project Pages base path before route matching', () => {
    expect(stripBasePath('/nib/', '/nib/')).toBe('/')
    expect(stripBasePath('/nib/docs/', '/nib/')).toBe('/docs/')
    expect(stripBasePath('/nib/docs/?draft=1#top', '/nib/')).toBe('/docs/?draft=1#top')
  })

  it('leaves root and unrelated paths unchanged', () => {
    expect(stripBasePath('/docs/', '/')).toBe('/docs/')
    expect(stripBasePath('/other/', '/nib/')).toBe('/other/')
  })

  it('builds links from the Vite base URL', () => {
    expect(siteHref('/docs/')).toBe('/docs/')
  })

  it('canonicalizes the pathname without corrupting query strings or hashes', () => {
    expect(withBuildUrlConfig('/', 'always', () => (
      siteHref('/search?tag=web#results')
    ))).toBe('/search/?tag=web#results')
    expect(withBuildUrlConfig('/journal/', 'always', () => (
      siteHref('/docs/?draft=1#top')
    ))).toBe('/journal/docs/?draft=1#top')
    expect(withBuildUrlConfig('/', 'never', () => (
      siteHref('/search/?tag=web#results')
    ))).toBe('/search?tag=web#results')
  })
})
