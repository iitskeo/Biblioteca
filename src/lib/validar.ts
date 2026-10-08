// Limpia y valida lo que llega del panel antes de guardarlo.
import type { Prompt } from './db';

export type DatosEntrada = {
  titulo: string;
  fecha: string;
  herramientas: string[];
  prompts: Prompt[];
  notas: string;
  video: string;
  poster: string | null;
  formato: string;
  sonido: boolean;
  tiktok: string | null;
  borrador: boolean;
  portada: boolean;
};

const FORMATOS = ['9:16', '16:9', '1:1', '4:5'];
const CLAVE_VIDEO = /^videos\/[a-z0-9-]+\.(mp4|webm|mov)$/;
const CLAVE_POSTER = /^posters\/[a-z0-9-]+\.(jpg|webp|png)$/;

const texto = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

export function validar(cuerpo: unknown): { ok: true; datos: DatosEntrada } | { ok: false; error: string } {
  if (!cuerpo || typeof cuerpo !== 'object') return { ok: false, error: 'No llegaron datos.' };
  const c = cuerpo as Record<string, unknown>;

  const titulo = texto(c.titulo, 120);
  if (!titulo) return { ok: false, error: 'Falta el título.' };

  const fecha = texto(c.fecha, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha) || Number.isNaN(Date.parse(fecha)))
    return { ok: false, error: 'La fecha no es válida.' };

  const herramientas = (Array.isArray(c.herramientas) ? c.herramientas : [])
    .map((h) => texto(h, 40))
    .filter(Boolean)
    .slice(0, 12);

  const prompts = (Array.isArray(c.prompts) ? c.prompts : [])
    .map((p) => ({
      etiqueta: texto((p as Prompt)?.etiqueta, 40) || 'Prompt',
      texto: texto((p as Prompt)?.texto, 8000),
    }))
    .filter((p) => p.texto)
    .slice(0, 12);
  if (!prompts.length) return { ok: false, error: 'Agrega al menos un prompt.' };

  const video = texto(c.video, 200);
  if (!CLAVE_VIDEO.test(video)) return { ok: false, error: 'Falta el video.' };

  const poster = texto(c.poster, 200) || null;
  if (poster && !CLAVE_POSTER.test(poster)) return { ok: false, error: 'La portada no es válida.' };

  const formato = FORMATOS.includes(c.formato as string) ? (c.formato as string) : '9:16';

  let tiktok = texto(c.tiktok, 300) || null;
  if (tiktok) {
    try {
      const url = new URL(tiktok);
      if (url.protocol !== 'https:' || !/(^|\.)tiktok\.com$/.test(url.hostname))
        return { ok: false, error: 'El link de TikTok tiene que ser de tiktok.com.' };
      tiktok = url.href;
    } catch {
      return { ok: false, error: 'El link de TikTok no es válido.' };
    }
  }

  return {
    ok: true,
    datos: {
      titulo,
      fecha,
      herramientas,
      prompts,
      notas: texto(c.notas, 4000),
      video,
      poster,
      formato,
      sonido: c.sonido === true,
      tiktok,
      borrador: c.borrador === true,
      portada: c.portada === true,
    },
  };
}
