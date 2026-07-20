import { builtinModules } from 'node:module'
import path from 'node:path'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const entries = {
  cli: path.resolve('src/cli.ts'),
  index: path.resolve('src/index.ts'),
  plugin: path.resolve('src/plugin.ts'),
  sitemap: path.resolve('src/sitemap.ts'),
  rss: path.resolve('src/rss.ts'),
  verify: path.resolve('src/verify.ts'),
  hosting: path.resolve('src/hosting.ts'),
  'internal/client': path.resolve('src/runtime/client.ts'),
  'internal/server': path.resolve('src/runtime/server.ts'),
}

const builtins = new Set([...builtinModules, ...builtinModules.map((name) => `node:${name}`)])

export default defineConfig({
  plugins: [react()],
  build: {
    emptyOutDir: true,
    lib: {
      entry: entries,
      formats: ['es'],
    },
    outDir: 'dist/framework',
    rollupOptions: {
      external(id) {
        return builtins.has(id)
          || (!id.startsWith('.') && !path.isAbsolute(id) && !id.startsWith('\0'))
      },
      output: {
        chunkFileNames: 'chunks/[name]-[hash].js',
        entryFileNames: '[name].js',
      },
    },
    target: 'node20',
  },
})
