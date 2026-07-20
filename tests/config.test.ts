import { describe, expect, it } from 'vitest'
import { defineConfig } from '../src/index'
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
      pageSources: {},
      site: { title: 'Site' },
    })).toThrow('pageSources must be an array')
    expect(() => validateNibConfig({
      collections: { posts: {} },
      site: { title: 'Site' },
    })).toThrow('loader function')
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
})
