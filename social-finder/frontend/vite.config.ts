import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// En développement, l'API FastAPI tourne sur le port 8765 ; en production elle sert elle-même ce dossier dist/.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: { port: 5174, proxy: { '/api': 'http://127.0.0.1:8765' } },
  build: { outDir: 'dist', chunkSizeWarningLimit: 900 },
});
