// Utilidades compartidas por las páginas públicas (sin acceso a datos).

export const HANDLE = '@itskeo5';
export const TIKTOK_URL = 'https://www.tiktok.com/@itskeo5';

const formatoFecha = new Intl.DateTimeFormat('es', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
});
export const fecha = (iso: string) => formatoFecha.format(new Date(`${iso}T00:00:00Z`)).replace('.', '');

export const aspecto = (formato: string) => formato.replace(':', ' / ');
export const esHorizontal = (formato: string) => formato === '16:9';

export { normalizar } from './normalizar';

export const vtName = (id: string) => `v-${id.replace(/[^a-z0-9-]/gi, '-')}`;

// Las claves de R2 se sirven desde /media/<clave>; una URL completa se respeta tal cual.
export const media = (clave: string | null | undefined) =>
  !clave ? undefined : /^https?:\/\//.test(clave) ? clave : `/media/${clave}`;
