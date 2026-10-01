import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    // Bound DOM workers so accessibility checks remain reliable alongside local services.
    maxWorkers: 2,
    globals: false,
    setupFiles: './src/test/setup.ts',
    testTimeout: 15_000,
  },
});
