import { defineConfig, siteMetadata } from '@briansunter/nib'
import tailwindcss from '@tailwindcss/vite'
import { SiteShell } from './src/site-shell'
import { site } from './src/site'

export default defineConfig({
  vite: () => tailwindcss(),
  shell: SiteShell,
  plugins: [
    siteMetadata({
      title: site.name,
      description: site.description,
      titleTemplate: `%s | ${site.name}`,
    }),
  ],
})
