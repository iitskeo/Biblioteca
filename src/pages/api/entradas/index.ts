import type { APIRoute } from 'astro';
import { autorizado, json, noAutorizado } from '../../../lib/auth';
import { crear, listar } from '../../../lib/db';
import { validar } from '../../../lib/validar';

// Lista completa (con borradores) para el panel.
export const GET: APIRoute = async ({ request }) => {
  if (!(await autorizado(request))) return noAutorizado();
  return json({ entradas: await listar({ conBorradores: true }) });
};

export const POST: APIRoute = async ({ request }) => {
  if (!(await autorizado(request))) return noAutorizado();
  const v = validar(await request.json().catch(() => null));
  if (!v.ok) return json({ error: v.error }, 400);
  const id = await crear(v.datos);
  return json({ id }, 201);
};
