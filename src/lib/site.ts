import { getCollection, type CollectionEntry } from 'astro:content';

export const HANDLE = '@itskeo5';
export const TIKTOK_URL = 'https://www.tiktok.com/@itskeo5';

export type Entrada = CollectionEntry<'prompts'>;

// Más recientes primero. Los borradores solo se ven con `npm run dev`.
export async function getEntradas(): Promise<Entrada[]> {
  const todas = await getCollection('prompts', ({ data }) => import.meta.env.DEV || !data.borrador);
  return todas.sort((a, b) => b.data.fecha.valueOf() - a.data.fecha.valueOf());
}

const formatoFecha = new Intl.DateTimeFormat('es', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
});
export const fecha = (d: Date) => formatoFecha.format(d).replace('.', '');

export const aspecto = (formato: string) => formato.replace(':', ' / ');
export const esHorizontal = (formato: string) => formato === '16:9';

export { normalizar } from './normalizar';

export const vtName = (id: string) => `v-${id.replace(/[^a-z0-9-]/gi, '-')}`;
