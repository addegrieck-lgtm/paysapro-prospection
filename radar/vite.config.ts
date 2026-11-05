import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// Interface React (src/client) servie par le Worker via « Workers Static Assets » (dossier dist/client).
// En développement, /api est relayé vers le serveur Node local (npm run dev:api, port 8788).
export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: { outDir: 'dist/client', emptyOutDir: true, chunkSizeWarningLimit: 900 },
  server: { port: 5280, proxy: { '/api': 'http://localhost:8788' } },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    testTimeout: 20000,
  },
});
