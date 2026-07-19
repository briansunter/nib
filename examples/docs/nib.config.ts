import { defineConfig } from '@briansunter/nib'
import tailwindcss from '@tailwindcss/vite'
import { SiteShell } from './src/site-shell'

export default defineConfig({
  site: {
    title: 'Nib',
    description: 'A static-site framework for React, Markdown, data pages, and opt-in islands.',
    titleTemplate: '%s | Nib',
    navigation: [
      { label: 'Home', href: '/' },
      { label: 'About', href: '/about/' },
      { label: 'Docs', href: '/docs/' },
    ],
  },
  vite: () => tailwindcss(),
  shell: SiteShell,
})
