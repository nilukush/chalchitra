import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';

// Canonical site URL — override with SITE_URL env var when deploying to a real domain.
const SITE_URL = process.env.SITE_URL ?? 'https://chalachitra.example';

export default defineConfig({
  site: SITE_URL,
  output: 'static',
  trailingSlash: 'never',
  integrations: [sitemap()],
  vite: {
    plugins: [tailwindcss()],
  },
  build: {
    inlineStylesheets: 'auto',
  },
});
