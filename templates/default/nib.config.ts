import { defineConfig } from '@briansunter/nib'
import tailwindcss from '@tailwindcss/vite'
import { SiteShell } from './src/site-shell'

export default defineConfig({
  site: {
    title: 'My Nib Site',
    description: 'A static site built with Nib for pages and data.',
    titleTemplate: '%s | My Nib Site',
    navigation: [
      { label: 'Home', href: '/' },
      { label: 'About', href: '/about/' },
    ],
  },
  vite: () => tailwindcss(),
  shell: SiteShell,
})
