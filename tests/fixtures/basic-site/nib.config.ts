import { defineConfig } from '@briansunter/nib'
import { SiteShell } from './src/site-shell'

export default defineConfig({
  base: '/journal/',
  site: {
    title: 'Journal',
    description: 'A test journal.',
    titleTemplate: '%s | Journal',
  },
  shell: SiteShell,
})
