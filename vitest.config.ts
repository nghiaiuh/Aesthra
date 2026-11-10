import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    conditions: ['development'],
  },
  test: {
    environment: 'node',
    include: ['packages/*/src/**/*.test.ts', 'apps/*/src/**/*.test.ts', 'tests/**/*.test.ts'],
    testTimeout: 15000,
  },
});

