export interface DocumentationLink {
  readonly label: string
  readonly href: string
  readonly description: string
}

export const documentation = [
  {
    label: 'START HERE',
    links: [
      { label: 'Overview', href: '/docs/', description: 'What Nib is' },
      { label: 'Getting started', href: '/docs/getting-started/', description: 'Scaffold a site' },
    ],
  },
  {
    label: 'BUILD',
    links: [
      { label: 'Pages and routes', href: '/docs/pages-and-routes/', description: 'Turn files into URLs' },
      { label: 'Markdown and layouts', href: '/docs/markdown-and-layouts/', description: 'Write content in context' },
      { label: 'Data and collections', href: '/docs/data-pages-and-collections/', description: 'Generate typed pages and lists' },
      { label: 'Image optimization', href: '/docs/image-optimization/', description: 'Build responsive local images' },
      { label: 'Plugin content and routing', href: '/docs/plugin-content-and-routing/', description: 'Extend formats and static routes' },
      { label: 'React islands', href: '/docs/react-islands/', description: 'Add interaction selectively' },
      { label: 'Client navigation', href: '/docs/client-navigation/', description: 'Enhance static links optionally' },
    ],
  },
  {
    label: 'SHIP',
    links: [
      { label: 'GitHub Pages', href: '/docs/github-pages/', description: 'Deploy static output' },
      { label: 'Releases', href: '/docs/releases/', description: 'Version and publish Nib' },
    ],
  },
] as const satisfies readonly {
  readonly label: string
  readonly links: readonly DocumentationLink[]
}[]
