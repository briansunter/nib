import { defineConfig } from '@briansunter/nib'
import { SiteShell } from './src/site-shell'

export default defineConfig({
  site: {
    title: 'Nib',
    description: 'A static-site framework for React, Markdown, and opt-in islands.',
    titleTemplate: '%s | Nib',
    navigation: [
      { label: 'Home', href: '/' },
      { label: 'About', href: '/about/' },
      { label: 'Docs', href: '/docs/' },
    ],
  },
  shell: SiteShell,
})
