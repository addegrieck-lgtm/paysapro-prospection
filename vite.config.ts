import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

// base './' : fonctionne depuis n'importe quel sous-dossier (GitHub Pages) sans configuration.
export default defineConfig({
  base: './',
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: false, // enregistrement manuel dans src/pwa.ts
      manifest: false, // manifest écrit à la main : public/manifest.webmanifest
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,svg,webmanifest,json}'],
        // Instantanés OpenStreetMap locaux (plusieurs Mo, générés à la mise en ligne) : téléchargés au premier
        // enrichissement puis conservés dans la base locale, inutile de les mettre dans le cache hors ligne
        globIgnores: ['**/data/osm-local-*.json'],
        navigateFallback: 'index.html',
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: true,
      },
    }),
  ],
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});
