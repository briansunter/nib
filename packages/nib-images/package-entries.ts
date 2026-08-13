export interface ImagePackageEntry {
  readonly name: string
  readonly exportKey: string
  readonly source: string
  readonly javascript: string
  readonly types: string
}

/** Canonical source/output map owned by the independently released image package. */
export const imagePackageEntries = Object.freeze([
  {
    name: 'index',
    exportKey: '.',
    source: 'src/index.ts',
    javascript: './dist/index.js',
    types: './dist/index.d.ts',
  },
  {
    name: 'plugin',
    exportKey: './plugin',
    source: 'src/plugin.ts',
    javascript: './dist/plugin.js',
    types: './dist/plugin.d.ts',
  },
  {
    name: 'content',
    exportKey: './content',
    source: 'src/content.ts',
    javascript: './dist/content.js',
    types: './dist/content.d.ts',
  },
] as const satisfies readonly ImagePackageEntry[])
