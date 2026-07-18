import type { SiteConfig } from './framework/types'

export default {
  title: 'Nib',
  description: 'A small static-site starter for React, Markdown, and opt-in islands.',
  titleTemplate: '%s | Nib',
  navigation: [
    { label: 'Home', href: '/' },
    { label: 'About', href: '/about/' },
    { label: 'Docs', href: '/docs/' }
  ]
} satisfies SiteConfig
