import { defineConfig } from '@briansunter/nib'

export default defineConfig({
  vite(context) {
    if (context.target !== 'client') return []
    return [{
      name: 'static-only-client-hook-proof',
      generateBundle() {
        this.emitFile({
          type: 'asset',
          fileName: 'client-target-hook.txt',
          source: 'client hook ran',
        })
      },
    }]
  },
})
