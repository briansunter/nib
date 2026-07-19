import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/cli.ts',
        'src/framework/types.ts',
        'src/runtime/server.ts',
        'packages/**',
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
