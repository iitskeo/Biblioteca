import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

// Cada archivo .md dentro de src/content/prompts es una entrada de la biblioteca.
// El nombre del archivo es la URL: neon-city.md -> /p/neon-city
const prompts = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/prompts' }),
  schema: z.object({
    titulo: z.string(),
    fecha: z.coerce.date(),
    // Tipo de video. Es el filtro de la biblioteca: "Abstracto", "Logos", "Personajes", "Transiciones"...
    categoria: z.string().default('Varios'),
    // Herramientas usadas, en el orden del flujo: ["Midjourney v7", "Kling 2.5"]
    herramientas: z.array(z.string()).min(1),
    // Ruta dentro de /public (ej. /videos/neon-city.mp4) o una URL completa (R2, CDN...)
    video: z.string(),
    poster: z.string().optional(),
    formato: z.enum(['9:16', '16:9', '1:1', '4:5']).default('9:16'),
    // true si el video trae audio (muestra el botón de sonido en su página)
    sonido: z.boolean().default(false),
    tiktok: z.string().url().optional(),
    // Uno o varios prompts: imagen, video, negativo, etc.
    prompts: z
      .array(
        z.object({
          etiqueta: z.string(),
          texto: z.string(),
        }),
      )
      .min(1),
    // true = no se publica (útil para preparar una entrada antes de subir el video a TikTok)
    borrador: z.boolean().default(false),
  }),
});

export const collections = { prompts };
