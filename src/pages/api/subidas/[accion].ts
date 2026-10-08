// Subida de archivos a R2 desde el panel.
//
// Videos (cualquier tamaño), en partes de 8 MB con la subida multiparte de R2:
//   POST /api/subidas/iniciar   { tipo: "video", ext }        -> { clave, uploadId }
//   PUT  /api/subidas/parte?clave=&uploadId=&n=  (cuerpo: la parte) -> { partNumber, etag }
//   POST /api/subidas/terminar  { clave, uploadId, partes }   -> { clave }
//   POST /api/subidas/abortar   { clave, uploadId }
// Portadas (pequeñas), de una vez:
//   PUT  /api/subidas/portada?ext=jpg  (cuerpo: la imagen)     -> { clave }
import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { autorizado, json, noAutorizado } from '../../../lib/auth';

const VIDEO_EXT: Record<string, string> = { mp4: 'video/mp4', webm: 'video/webm', mov: 'video/quicktime' };
const IMAGEN_EXT: Record<string, string> = { jpg: 'image/jpeg', webp: 'image/webp', png: 'image/png' };
const MAX_PORTADA = 5 * 1024 * 1024;

const nuevaClave = (carpeta: string, ext: string) => {
  const azar = [...crypto.getRandomValues(new Uint8Array(5))].map((b) => b.toString(16).padStart(2, '0')).join('');
  return `${carpeta}/${Date.now().toString(36)}-${azar}.${ext}`;
};
const claveVideo = (c: unknown): c is string => typeof c === 'string' && /^videos\/[a-z0-9-]+\.(mp4|webm|mov)$/.test(c);

export const POST: APIRoute = async ({ request, params }) => {
  if (!(await autorizado(request))) return noAutorizado();
  const cuerpo = (await request.json().catch(() => ({}))) as Record<string, unknown>;

  if (params.accion === 'iniciar') {
    const ext = String(cuerpo.ext ?? '').toLowerCase();
    if (!VIDEO_EXT[ext]) return json({ error: 'Ese formato de video no se acepta (usa MP4, WebM o MOV).' }, 400);
    const clave = nuevaClave('videos', ext);
    const subida = await env.MEDIA.createMultipartUpload(clave, {
      httpMetadata: { contentType: VIDEO_EXT[ext], cacheControl: 'public, max-age=31536000, immutable' },
    });
    return json({ clave, uploadId: subida.uploadId });
  }

  if (params.accion === 'terminar') {
    if (!claveVideo(cuerpo.clave) || typeof cuerpo.uploadId !== 'string' || !Array.isArray(cuerpo.partes))
      return json({ error: 'Faltan datos para cerrar la subida.' }, 400);
    const subida = env.MEDIA.resumeMultipartUpload(cuerpo.clave, cuerpo.uploadId);
    const partes = (cuerpo.partes as R2UploadedPart[]).map((p) => ({ partNumber: Number(p.partNumber), etag: String(p.etag) }));
    await subida.complete(partes);
    return json({ clave: cuerpo.clave });
  }

  if (params.accion === 'abortar') {
    if (claveVideo(cuerpo.clave) && typeof cuerpo.uploadId === 'string') {
      await env.MEDIA.resumeMultipartUpload(cuerpo.clave, cuerpo.uploadId).abort().catch(() => {});
    }
    return json({ ok: true });
  }

  return json({ error: 'Acción desconocida.' }, 404);
};

export const PUT: APIRoute = async ({ request, params, url }) => {
  if (!(await autorizado(request))) return noAutorizado();
  if (!request.body) return json({ error: 'El archivo llegó vacío.' }, 400);

  if (params.accion === 'parte') {
    const clave = url.searchParams.get('clave');
    const uploadId = url.searchParams.get('uploadId');
    const n = Number(url.searchParams.get('n'));
    if (!claveVideo(clave) || !uploadId || !Number.isInteger(n) || n < 1 || n > 10000)
      return json({ error: 'Parte inválida.' }, 400);
    const parte = await env.MEDIA.resumeMultipartUpload(clave, uploadId).uploadPart(n, await request.arrayBuffer());
    return json(parte);
  }

  if (params.accion === 'portada') {
    const ext = (url.searchParams.get('ext') ?? '').toLowerCase();
    if (!IMAGEN_EXT[ext]) return json({ error: 'La portada tiene que ser JPG, WebP o PNG.' }, 400);
    const datos = await request.arrayBuffer();
    if (datos.byteLength > MAX_PORTADA) return json({ error: 'La portada pesa demasiado.' }, 400);
    const clave = nuevaClave('posters', ext);
    await env.MEDIA.put(clave, datos, {
      httpMetadata: { contentType: IMAGEN_EXT[ext], cacheControl: 'public, max-age=31536000, immutable' },
    });
    return json({ clave });
  }

  return json({ error: 'Acción desconocida.' }, 404);
};
