import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

// GitHub Pages serves project sites from /<repo>/, so the base path is injected
// at build time. Local dev and root-domain hosts keep "/".
const base = process.env.VITE_BASE_PATH ?? '/';

export default defineConfig({
  base,
  plugins: [react()],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  server: { port: 5173, host: true },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          echarts: ['echarts'],
          leaflet: ['leaflet'],
          react: ['react', 'react-dom', 'react-router-dom'],
        },
      },
    },
    chunkSizeWarningLimit: 2000,
  },
});
