import path from 'node:path'
import { builtinModules } from 'node:module'
import { defineConfig } from 'vite'

const entries = {
  index: path.resolve('src/index.ts'),
  plugin: path.resolve('src/plugin.ts'),
}
const builtins = new Set([...builtinModules, ...builtinModules.map((name) => `node:${name}`)])

export default defineConfig({
  build: {
    emptyOutDir: true,
    lib: { entry: entries, formats: ['es'] },
    outDir: 'dist',
    rollupOptions: {
      external(id) {
        return builtins.has(id)
          || id === 'react'
          || id === 'react/jsx-runtime'
          || id === '@briansunter/nib'
          || id === '@briansunter/nib/plugin'
          || id === 'sharp'
      },
      output: { entryFileNames: '[name].js' },
    },
    target: 'node20',
  },
})
