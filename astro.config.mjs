// @ts-check
import { defineConfig } from 'astro/config';

export default defineConfig({
  // Dominio público. Se usa para las vistas previas al compartir (og:image).
  // Cámbialo cuando conectes tu dominio propio en Cloudflare.
  site: process.env.SITE_URL || 'https://biblioteca.itskeo.workers.dev',
  build: { format: 'directory' },
  devToolbar: { enabled: false },
});
