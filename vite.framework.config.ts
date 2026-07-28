import { builtinModules } from 'node:module'
import path from 'node:path'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { frameworkPackageEntries } from './package-entries'

const entries = Object.fromEntries(
  frameworkPackageEntries.map((entry) => [entry.name, path.resolve(entry.source)]),
)

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
