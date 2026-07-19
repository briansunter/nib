import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: [
        'src/framework/document.ts',
        'src/framework/island-paths.ts',
        'src/framework/island-serialization.ts',
        'src/framework/island-vite-plugin.ts',
        'src/framework/island-runtime.ts',
        'src/framework/islands.tsx',
        'src/framework/markdown.ts',
        'src/framework/meta.ts',
        'src/framework/paths.ts',
        'src/framework/project-config.ts',
        'src/framework/project-vite-plugin.ts',
        'src/framework/render-page.tsx',
        'src/framework/router.ts',
        'src/framework/site.ts',
        'src/framework/urls.ts',
        'src/runtime/client.ts',
        'src/scaffold.ts'
      ],
      thresholds: {
        lines: 85,
        functions: 85,
        statements: 85,
        branches: 75
      }
    }
  }
})
