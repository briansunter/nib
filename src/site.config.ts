import type { SiteConfig } from './framework/types'

export default {
  title: 'Nib',
  description: 'A tiny file-routed static-site starter with TSX, Markdown, and React islands.',
  titleTemplate: '%s | Nib',
  navigation: [
    { label: 'Home', href: '/' },
    { label: 'About', href: '/about/' },
    { label: 'Docs', href: '/docs/' }
  ]
} satisfies SiteConfig
