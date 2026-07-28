import { definePlugin } from '@briansunter/nib/plugin'

export const site = {
  name: 'Commonplace',
  description: 'Sample field notes about making, noticing, and learning.',
  navigation: [
    { label: 'Home', href: '/' },
    { label: 'Posts', href: '/posts/' },
    { label: 'About', href: '/about/' },
  ],
} as const

export const siteMetadata = definePlugin({
  name: 'blog-site-metadata',
  renderer() {
    return {
      head({ route }) {
        return {
          title: route.path === '/' ? site.name : `${route.meta.title} · ${site.name}`,
          description: route.meta.description ?? site.description,
          elements: [
            {
              tag: 'link',
              attributes: {
                rel: 'icon',
                type: 'image/svg+xml',
                href: '/favicon.svg',
              },
            },
            {
              tag: 'link',
              attributes: {
                rel: 'alternate',
                type: 'application/rss+xml',
                href: '/rss.xml',
              },
            },
          ],
        }
      },
    }
  },
})
