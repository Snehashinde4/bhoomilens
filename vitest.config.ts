import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  test: {
    environment: 'node',
    globals: true,
    include: ['src/test/**/*.test.ts'],
    reporters: ['default'],
    testTimeout: 30_000,
    // The worker-thread pool is unreliable on some Windows setups; forks are stable.
    pool: 'forks',
    fileParallelism: false,
  },
});
