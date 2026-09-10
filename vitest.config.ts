import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['packages/**/src/**/*.test.ts', 'tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['packages/**/src/**/*.ts'],
      exclude: ['**/*.test.ts', '**/*.d.ts', '**/index.ts'],
    },
  },
  resolve: {
    alias: {
      '@navic/shared-models': resolve(__dirname, 'packages/shared-models/src'),
      '@navic/gnss-core': resolve(__dirname, 'packages/gnss-core/src'),
      '@navic/sensor-fusion': resolve(__dirname, 'packages/sensor-fusion/src'),
      '@navic/navigation-core': resolve(__dirname, 'packages/navigation-core/src'),
      '@navic/routing-core': resolve(__dirname, 'packages/routing-core/src'),
      '@navic/map-core': resolve(__dirname, 'packages/map-core/src'),
    },
  },
});
