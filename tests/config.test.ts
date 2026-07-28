import { describe, expect, it } from 'vitest'
import {
  defineConfig,
  definePageSource,
  fromMarkdownPages,
  fromPageSource,
} from '../src/index'
import { configuredPageSources } from '../src/framework/plugin-contributions'
import { resolveBasePath, validateNibConfig } from '../src/framework/project-config'

describe('Nib configuration', () => {
  it('keeps the complete typed framework configuration', () => {
    function Shell() {
      return null
    }
    const config = defineConfig({
      base: '/notes/',
      origin: 'https://notes.example',
      shell: Shell,
    })

    expect(config).toEqual({
      base: '/notes/',
      origin: 'https://notes.example',
      shell: Shell,
    })
  })

  it('resolves explicit, environment, GitHub Pages, and root base paths in order', () => {
    const config = defineConfig({})
    expect(resolveBasePath({ ...config, base: '/explicit/' }, {
      SITE_BASE_PATH: '/environment/',
    })).toBe('/explicit/')
    expect(resolveBasePath(config, { SITE_BASE_PATH: '/environment/' }))
      .toBe('/environment/')
    expect(resolveBasePath(config, {
      GITHUB_ACTIONS: 'true',
      GITHUB_REPOSITORY: 'owner/project',
    })).toBe('/project/')
    expect(resolveBasePath(config, {})).toBe('/')
  })

  it('rejects malformed public configuration before Vite starts', () => {
    expect(validateNibConfig({})).toEqual({})
    expect(() => validateNibConfig({ site: { title: 'Site' } }))
      .toThrow('unsupported field site')
    expect(() => validateNibConfig({ origin: 'ftp://example.test' })).toThrow('HTTP or HTTPS')
    expect(() => validateNibConfig({
      base: 'nested',
    })).toThrow('start and end with "/"')
    expect(() => validateNibConfig({
      shell: 'not a component',
    })).toThrow('React component')
    expect(() => validateNibConfig({
      vite: true,
    })).toThrow('must be a function that returns Vite plugins')
    expect(() => validateNibConfig({
      trailingSlash: 'sometimes',
    })).toThrow('trailingSlash')
    expect(() => validateNibConfig({
      redirects: { old: '/new' },
    })).toThrow('redirect source')
    expect(() => validateNibConfig({
      base: '//cdn.example/',
    })).toThrow('start and end with "/"')
    expect(() => validateNibConfig({
      redirects: { '//evil.example/old': '/new' },
    })).toThrow('redirect source')
    expect(() => validateNibConfig({
      redirects: { '/old': '//evil.example/new' },
    })).toThrow('redirect destination')
    expect(() => validateNibConfig({
      redirects: { '/old': 'javascript:alert(1)' },
    })).toThrow('redirect destination')
    expect(() => validateNibConfig({
      redirects: { '/old': { destination: '/new', status: 305 } },
    })).toThrow('unsupported status')
    expect(() => validateNibConfig({
      markdown: { schema: {} },
    })).toThrow('parse(value)')
    expect(() => validateNibConfig({
      markdown: { remarkPlugins: true },
    })).toThrow('remarkPlugins must be an array')
    expect(() => validateNibConfig({
      markdown: { gfm: 'yes' },
    })).toThrow('gfm must be a boolean')
    expect(() => validateNibConfig({
      pageSources: {},
    })).toThrow('pageSources must be an array')
    expect(() => validateNibConfig({
      collections: { posts: {} },
    })).toThrow('loader function')
    expect(validateNibConfig({
      collections: {
        posts: fromMarkdownPages({
          match: () => true,
          id: (page) => page.path,
          select: (page) => page.meta,
        }),
      },
    })).toMatchObject({ collections: { posts: { pages: true, markdownOnly: true } } })
    expect(() => validateNibConfig({
      collections: { posts: { pages: true, markdownOnly: true } },
    })).toThrow('page selector')
    expect(validateNibConfig({
      hosting: { adapters: ['netlify', 'vercel', 'cloudflare', 's3'] },
    })).toMatchObject({ hosting: { adapters: ['netlify', 'vercel', 'cloudflare', 's3'] } })
    expect(() => validateNibConfig({
      hosting: { adapters: ['firebase'] },
    })).toThrow('hosting adapters')
  })

  it('uses one unambiguous validation seam for all content definitions', () => {
    const parse = (value: unknown) => value
    expect(() => validateNibConfig({
      markdown: { schema: { parse }, validate: parse },
    })).toThrow('either schema or validate')
    expect(() => validateNibConfig({
      pageSources: [{
        extensions: ['csv'],
        schema: parse,
        load: async () => ({ data: {}, meta: { title: 'CSV' } }),
        component: () => null,
      }],
    })).toThrow('schema must provide parse(value)')
    expect(() => validateNibConfig({
      collections: { posts: { schema: parse, loader: async () => [] } },
    })).toThrow('schema must provide parse(value)')
  })

  it('discovers collection-referenced and plugin page sources once by identity', () => {
    const collectionSource = definePageSource({
      extensions: ['json'],
      load: ({ source }) => ({ data: JSON.parse(source), meta: { title: 'JSON' } }),
      component: () => null,
    })
    const pluginSource = definePageSource({
      extensions: ['toml'],
      load: ({ source }) => ({ data: source, meta: { title: 'TOML' } }),
      component: () => null,
    })
    const config = validateNibConfig({
      pageSources: [collectionSource],
      collections: {
        records: fromPageSource(collectionSource),
      },
      plugins: [{
        name: 'formats',
        pageSources: [collectionSource, pluginSource],
      }],
    })

    expect(configuredPageSources(config)).toEqual([collectionSource, pluginSource])
    expect(Object.isFrozen(configuredPageSources(config))).toBe(true)

    const collectionOnly = validateNibConfig({
      collections: { records: fromPageSource(collectionSource) },
    })
    expect(configuredPageSources(collectionOnly)).toEqual([collectionSource])
  })
})
