import { definePlugin } from '@briansunter/nib/plugin'

export const site = {
  name: 'My Nib Site',
  description: 'A static site built with Nib for pages and data.',
  navigation: [
    { label: 'Home', href: '/' },
    { label: 'About', href: '/about/' },
  ],
} as const

export const siteMetadata = definePlugin({
  name: 'site-metadata',
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
