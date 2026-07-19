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
      { label: 'React islands', href: '/docs/react-islands/', description: 'Add interaction selectively' },
    ],
  },
  {
    label: 'SHIP',
    links: [
      { label: 'GitHub Pages', href: '/docs/github-pages/', description: 'Deploy static output' },
      { label: 'Releases', href: '/docs/releases/', description: 'Version and publish Nib' },
    ],
  },
] as const
