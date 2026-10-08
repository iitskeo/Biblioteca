// @ts-check
import { defineConfig } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';

export default defineConfig({
  // Dominio público. Se usa para las vistas previas al compartir (og:image).
  // Cámbialo cuando conectes tu dominio propio en Cloudflare.
  site: process.env.SITE_URL || 'https://biblioteca.itskeo.workers.dev',
  // Las páginas leen los prompts de D1 en cada visita: lo que subes en /panel aparece al instante.
  output: 'server',
  adapter: cloudflare({ imageService: 'passthrough' }),
  session: false,
  devToolbar: { enabled: false },
});
