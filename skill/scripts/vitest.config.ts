import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['__tests__/**/*.test.ts'],
    testTimeout: 30000,
    coverage: {
      provider: 'v8',
      include: ['rc-analyze.ts'],
      exclude: ['__tests__/**', 'vitest.config.ts', 'node_modules/**'],
      thresholds: {
        statements: 100,
        branches: 100,
        functions: 100,
        lines: 100,
      },
    },
  },
});
