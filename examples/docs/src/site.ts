import { definePlugin } from '@briansunter/nib/plugin'

export const site = {
  name: 'Nib',
  description: 'A static-site framework for React, Markdown, data pages, and opt-in islands.',
  navigation: [
    { label: 'Home', href: '/' },
    { label: 'About', href: '/about/' },
    { label: 'Docs', href: '/docs/' },
  ],
} as const

export const siteMetadata = definePlugin({
  name: 'docs-site-metadata',
  renderer() {
    return {
      head({ route }) {
        return {
          title: route.path === '/' ? site.name : `${route.meta.title} | ${site.name}`,
          description: route.meta.description ?? site.description,
        }
      },
    }
  },
})
