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
  it('keeps the complete typed site configuration available to the framework', () => {
    function Shell() {
      return null
    }
    const config = defineConfig({
      base: '/notes/',
      site: {
        title: 'Notes',
        description: 'A notebook.',
        navigation: [{ label: 'Home', href: '/' }],
      },
      shell: Shell,
    })

    expect(config).toEqual({
      base: '/notes/',
      site: {
        title: 'Notes',
        description: 'A notebook.',
        navigation: [{ label: 'Home', href: '/' }],
      },
      shell: Shell,
    })
  })

  it('resolves explicit, environment, GitHub Pages, and root base paths in order', () => {
    const config = defineConfig({ site: { title: 'Site' } })
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
    expect(() => validateNibConfig({})).toThrow('site configuration')
    expect(() => validateNibConfig({ site: { title: '' } })).toThrow('non-empty')
    expect(() => validateNibConfig({
      base: 'nested',
      site: { title: 'Site' },
    })).toThrow('start and end with "/"')
    expect(() => validateNibConfig({
      shell: 'not a component',
      site: { title: 'Site' },
    })).toThrow('React component')
    expect(() => validateNibConfig({
      site: { title: 'Site', description: 42 },
    })).toThrow('site.description')
    expect(() => validateNibConfig({
      site: { title: 'Site', titleTemplate: false },
    })).toThrow('site.titleTemplate')
    expect(() => validateNibConfig({
      site: { title: 'Site', navigation: [{ label: '', href: '/' }] },
    })).toThrow('site.navigation')
    expect(() => validateNibConfig({
      vite: true,
      site: { title: 'Site' },
    })).toThrow('must be a function that returns Vite plugins')
    expect(() => validateNibConfig({
      trailingSlash: 'sometimes',
      site: { title: 'Site' },
    })).toThrow('trailingSlash')
    expect(() => validateNibConfig({
      redirects: { old: '/new' },
      site: { title: 'Site' },
    })).toThrow('redirect source')
    expect(() => validateNibConfig({
      base: '//cdn.example/',
      site: { title: 'Site' },
    })).toThrow('start and end with "/"')
    expect(() => validateNibConfig({
      redirects: { '//evil.example/old': '/new' },
      site: { title: 'Site' },
    })).toThrow('redirect source')
    expect(() => validateNibConfig({
      redirects: { '/old': '//evil.example/new' },
      site: { title: 'Site' },
    })).toThrow('redirect destination')
    expect(() => validateNibConfig({
      redirects: { '/old': 'javascript:alert(1)' },
      site: { title: 'Site' },
    })).toThrow('redirect destination')
    expect(() => validateNibConfig({
      redirects: { '/old': { destination: '/new', status: 305 } },
      site: { title: 'Site' },
    })).toThrow('unsupported status')
    expect(() => validateNibConfig({
      markdown: { schema: {} },
      site: { title: 'Site' },
    })).toThrow('parse(value)')
    expect(() => validateNibConfig({
      markdown: { remarkPlugins: true },
      site: { title: 'Site' },
    })).toThrow('remarkPlugins must be an array')
    expect(() => validateNibConfig({
      markdown: { gfm: 'yes' },
      site: { title: 'Site' },
    })).toThrow('gfm must be a boolean')
    expect(() => validateNibConfig({
      pageSources: {},
      site: { title: 'Site' },
    })).toThrow('pageSources must be an array')
    expect(() => validateNibConfig({
      collections: { posts: {} },
      site: { title: 'Site' },
    })).toThrow('loader function')
    expect(validateNibConfig({
      collections: {
        posts: fromMarkdownPages({
          match: () => true,
          id: (page) => page.path,
          select: (page) => page.meta,
        }),
      },
      site: { title: 'Site' },
    })).toMatchObject({ collections: { posts: { pages: true, markdownOnly: true } } })
    expect(() => validateNibConfig({
      collections: { posts: { pages: true, markdownOnly: true } },
      site: { title: 'Site' },
    })).toThrow('page selector')
    expect(() => validateNibConfig({
      site: {
        title: 'Site',
        head: {
          elements: [{ tag: 'meta', attributes: { onclick: 'bad' } }],
        },
      },
    })).toThrow('unsafe attribute name')
    expect(validateNibConfig({
      site: { title: 'Site' },
      hosting: { adapters: ['netlify', 'vercel', 'cloudflare', 's3'] },
    })).toMatchObject({ hosting: { adapters: ['netlify', 'vercel', 'cloudflare', 's3'] } })
    expect(() => validateNibConfig({
      site: { title: 'Site' },
      hosting: { adapters: ['firebase'] },
    })).toThrow('hosting adapters')
  })

  it('uses one unambiguous validation seam for all content definitions', () => {
    const parse = (value: unknown) => value
    expect(() => validateNibConfig({
      markdown: { schema: { parse }, validate: parse },
      site: { title: 'Site' },
    })).toThrow('either schema or validate')
    expect(() => validateNibConfig({
      pageSources: [{
        extensions: ['csv'],
        schema: parse,
        load: async () => ({ data: {} }),
        component: () => null,
      }],
      site: { title: 'Site' },
    })).toThrow('schema must provide parse(value)')
    expect(() => validateNibConfig({
      collections: { posts: { schema: parse, loader: async () => [] } },
      site: { title: 'Site' },
    })).toThrow('schema must provide parse(value)')
  })

  it('discovers collection-referenced and plugin page sources once by identity', () => {
    const collectionSource = definePageSource({
      extensions: ['json'],
      load: ({ source }) => ({ data: JSON.parse(source) }),
      component: () => null,
    })
    const pluginSource = definePageSource({
      extensions: ['toml'],
      load: ({ source }) => ({ data: source }),
      component: () => null,
    })
    const config = validateNibConfig({
      site: { title: 'Site' },
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
      site: { title: 'Site' },
      collections: { records: fromPageSource(collectionSource) },
    })
    expect(configuredPageSources(collectionOnly)).toEqual([collectionSource])
  })
})
