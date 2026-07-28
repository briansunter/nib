import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      'examples/**/scripts/*.test.mjs',
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/cli.ts',
        // This controller is exercised in a DOM suite and the replica's real
        // browser matrix; V8's Node coverage cannot observe browser execution.
        'src/client/navigation.ts',
        'src/navigation/**/*.ts',
        'src/framework/types.ts',
        'src/internal/server.ts',
        'packages/**',
        'examples/**',
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
