// La clave del panel vive como secreto de Cloudflare (PANEL_CLAVE), nunca en el código.
// El panel la manda en "Authorization: Bearer <clave>".
import { env } from 'cloudflare:workers';

const sha256 = async (s: string) => crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));

export async function autorizado(request: Request): Promise<boolean> {
  const clave = env.PANEL_CLAVE;
  // Sin clave configurada (o demasiado corta) el panel queda cerrado.
  if (!clave || clave.length < 24) return false;
  const cabecera = request.headers.get('authorization') ?? '';
  const dada = cabecera.startsWith('Bearer ') ? cabecera.slice(7) : '';
  if (!dada) return false;
  // Comparación en tiempo constante sobre los hashes (mismo largo siempre).
  const [a, b] = await Promise.all([sha256(dada), sha256(clave)]);
  return crypto.subtle.timingSafeEqual(a, b);
}

export const json = (datos: unknown, status = 200) =>
  new Response(JSON.stringify(datos), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });

export const noAutorizado = () => json({ error: 'Clave incorrecta.' }, 401);
