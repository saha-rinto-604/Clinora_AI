import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 5173,
    // Proxy API calls to the backend during development so cookies remain same-site.
    // This avoids cross-origin Set-Cookie issues for the refresh cookie in dev.
    proxy: {
      '/api': 'http://localhost:8080',
    },
  },
});
