import { defineConfig } from '@briansunter/nib'
import tailwindcss from '@tailwindcss/vite'
import { SiteShell } from './src/site-shell'
import { siteMetadata } from './src/site'

export default defineConfig({
  vite: () => tailwindcss(),
  shell: SiteShell,
  plugins: [siteMetadata],
})
