// Sirve videos y portadas desde R2, con soporte de Range (Safari lo exige para reproducir video).
import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';

const PERMITIDO = /^(videos|posters)\/[a-z0-9-]+\.(mp4|webm|mov|jpg|webp|png)$/;

// Los videos solo se entregan a un reproductor <video> dentro de esta misma web.
// Abrir la URL en una pestaña, descargarla o incrustarla en otro sitio recibe 403.
// (Las portadas siguen públicas: son las vistas previas al compartir en redes.)
// No es infalible (nada en la web lo es: siempre se puede grabar la pantalla),
// pero quita todas las formas fáciles de bajarse el archivo.
function videoPermitido(request: Request): boolean {
  const destino = request.headers.get('sec-fetch-dest');
  const sitio = request.headers.get('sec-fetch-site');
  if (destino) return destino === 'video' && sitio === 'same-origin';
  // Navegadores viejos sin Sec-Fetch: exigir que la petición venga de una página de este sitio.
  const referer = request.headers.get('referer');
  try {
    return !!referer && new URL(referer).host === new URL(request.url).host;
  } catch {
    return false;
  }
}

async function servir(request: Request, clave: string | undefined, conCuerpo: boolean) {
  if (!clave || !PERMITIDO.test(clave)) return new Response('No encontrado', { status: 404 });
  if (clave.startsWith('videos/') && !videoPermitido(request)) {
    return new Response('Acceso denegado', {
      status: 403,
      headers: { 'cache-control': 'no-store', vary: 'Sec-Fetch-Dest, Sec-Fetch-Site, Referer' },
    });
  }

  const pideRango = request.headers.has('range');
  const objeto = await env.MEDIA.get(clave, {
    range: pideRango ? request.headers : undefined,
    onlyIf: request.headers,
  });
  if (!objeto) return new Response('No encontrado', { status: 404 });

  const headers = new Headers();
  objeto.writeHttpMetadata(headers);
  headers.set('etag', objeto.httpEtag);
  headers.set('accept-ranges', 'bytes');
  if (clave.startsWith('videos/')) {
    // Sin copia en la caché del navegador: abrir la URL en una pestaña siempre vuelve a pasar
    // por el control de arriba (si se guardara, el navegador podría servirla sin preguntar).
    headers.set('cache-control', 'no-store');
    headers.set('vary', 'Sec-Fetch-Dest, Sec-Fetch-Site, Referer');
    headers.set('content-disposition', 'inline');
  } else if (!headers.has('cache-control')) {
    headers.set('cache-control', 'public, max-age=31536000, immutable');
  }

  // onlyIf no se cumplió (If-None-Match coincide): el navegador ya lo tiene.
  if (!('body' in objeto)) return new Response(null, { status: 304, headers });

  const rango = objeto.range as { offset?: number; length?: number; suffix?: number } | undefined;
  if (pideRango && rango) {
    const inicio = rango.suffix !== undefined ? objeto.size - rango.suffix : (rango.offset ?? 0);
    const largo = rango.suffix !== undefined ? rango.suffix : (rango.length ?? objeto.size - inicio);
    headers.set('content-range', `bytes ${inicio}-${inicio + largo - 1}/${objeto.size}`);
    headers.set('content-length', String(largo));
    return new Response(conCuerpo ? objeto.body : null, { status: 206, headers });
  }

  headers.set('content-length', String(objeto.size));
  return new Response(conCuerpo ? objeto.body : null, { status: 200, headers });
}

export const GET: APIRoute = ({ request, params }) => servir(request, params.clave, true);
export const HEAD: APIRoute = ({ request, params }) => servir(request, params.clave, false);
