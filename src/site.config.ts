import type { SiteConfig } from './framework/types'

export default {
  title: 'Mini Static',
  description: 'A tiny file-routed React and Markdown static-site generator.',
  titleTemplate: '%s | Mini Static',
  navigation: [
    { label: 'Home', href: '/' },
    { label: 'About', href: '/about/' },
    { label: 'Docs', href: '/docs/' }
  ]
} satisfies SiteConfig
