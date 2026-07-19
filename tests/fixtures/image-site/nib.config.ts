import { defineConfig } from '@briansunter/nib'
import { images } from '@briansunter/nib-images'

export default defineConfig({
  site: { title: 'Images' },
  plugins: [images({ widths: [32, 64], formats: ['webp'] })],
})
