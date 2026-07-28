export interface PackageEntry {
  readonly name: string
  readonly source: string
  readonly javascript: string
  readonly types: string
  readonly exportKey?: string
}

/**
 * Canonical source/output map for the framework package.
 *
 * package.json remains the npm metadata source of truth; architecture tests
 * require every code export to agree with this build-owned manifest.
 */
export const frameworkPackageEntries = Object.freeze([
  {
    name: 'cli',
    source: 'src/cli.ts',
    javascript: './dist/framework/cli.js',
    types: './dist/framework/cli.d.ts',
  },
  {
    name: 'index',
    exportKey: '.',
    source: 'src/index.ts',
    javascript: './dist/framework/index.js',
    types: './dist/framework/index.d.ts',
  },
  {
    name: 'plugin',
    exportKey: './plugin',
    source: 'src/plugin.ts',
    javascript: './dist/framework/plugin.js',
    types: './dist/framework/plugin.d.ts',
  },
  {
    name: 'sitemap',
    exportKey: './sitemap',
    source: 'src/sitemap.ts',
    javascript: './dist/framework/sitemap.js',
    types: './dist/framework/sitemap.d.ts',
  },
  {
    name: 'rss',
    exportKey: './rss',
    source: 'src/rss.ts',
    javascript: './dist/framework/rss.js',
    types: './dist/framework/rss.d.ts',
  },
  {
    name: 'verify',
    exportKey: './verify',
    source: 'src/verify.ts',
    javascript: './dist/framework/verify.js',
    types: './dist/framework/verify.d.ts',
  },
  {
    name: 'testing',
    exportKey: './testing',
    source: 'src/testing.ts',
    javascript: './dist/framework/testing.js',
    types: './dist/framework/testing.d.ts',
  },
  {
    name: 'hosting',
    exportKey: './hosting',
    source: 'src/hosting.ts',
    javascript: './dist/framework/hosting.js',
    types: './dist/framework/hosting.d.ts',
  },
  {
    name: 'client',
    exportKey: './client',
    source: 'src/client.ts',
    javascript: './dist/framework/client.js',
    types: './dist/framework/client.d.ts',
  },
  {
    name: 'client/islands',
    exportKey: './client/islands',
    source: 'src/client/islands.ts',
    javascript: './dist/framework/client/islands.js',
    types: './dist/framework/client/islands.d.ts',
  },
  {
    name: 'client/behaviors',
    exportKey: './client/behaviors',
    source: 'src/client/behaviors.ts',
    javascript: './dist/framework/client/behaviors.js',
    types: './dist/framework/client/behaviors.d.ts',
  },
  {
    name: 'client/navigation',
    exportKey: './client/navigation',
    source: 'src/client/navigation.ts',
    javascript: './dist/framework/client/navigation.js',
    types: './dist/framework/client/navigation.d.ts',
  },
  {
    name: 'navigation',
    exportKey: './navigation',
    source: 'src/navigation.ts',
    javascript: './dist/framework/navigation.js',
    types: './dist/framework/navigation.d.ts',
  },
  {
    name: 'server',
    exportKey: './server',
    source: 'src/server.ts',
    javascript: './dist/framework/server.js',
    types: './dist/framework/server.d.ts',
  },
  {
    name: 'internal/server',
    exportKey: './internal/server',
    source: 'src/internal/server.ts',
    javascript: './dist/framework/internal/server.js',
    types: './dist/framework/internal/server.d.ts',
  },
] as const satisfies readonly PackageEntry[])
