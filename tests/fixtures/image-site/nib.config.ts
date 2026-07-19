import { defineConfig } from '@briansunter/nib'
import { images } from '@briansunter/nib-images/plugin'

export default defineConfig({
  site: { title: 'Images' },
  vite(context) {
    return { name: `image-site-app-vite-${context.target}` }
  },
  plugins: [images({ widths: [32, 64], formats: ['webp'] })],
})
