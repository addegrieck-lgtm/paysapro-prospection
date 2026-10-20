import { defineConfig } from 'astro/config';

// Adresse finale du site (sert au référencement et au plan du site). À changer pour chaque client.
export default defineConfig({
  site: process.env.SITE_URL || 'https://exemple.fr',
});
