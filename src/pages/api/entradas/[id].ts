import type { APIRoute } from 'astro';
import { autorizado, json, noAutorizado } from '../../../lib/auth';
import { actualizar, borrar } from '../../../lib/db';
import { validar } from '../../../lib/validar';

export const PUT: APIRoute = async ({ request, params }) => {
  if (!(await autorizado(request))) return noAutorizado();
  const v = validar(await request.json().catch(() => null));
  if (!v.ok) return json({ error: v.error }, 400);
  const antes = await actualizar(params.id!, v.datos);
  if (!antes) return json({ error: 'Ese prompt ya no existe.' }, 404);
  return json({ id: params.id });
};

export const DELETE: APIRoute = async ({ request, params }) => {
  if (!(await autorizado(request))) return noAutorizado();
  const ok = await borrar(params.id!);
  return ok ? json({ ok: true }) : json({ error: 'Ese prompt ya no existe.' }, 404);
};
