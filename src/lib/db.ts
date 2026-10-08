// Acceso a la tabla `entradas` de D1. Solo se usa en el servidor.
import { env } from 'cloudflare:workers';
import type { DatosEntrada } from './validar';

export type Prompt = { etiqueta: string; texto: string };

export type Entrada = {
  id: string;
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
};

type Fila = Omit<Entrada, 'herramientas' | 'prompts' | 'sonido' | 'borrador'> & {
  herramientas: string;
  prompts: string;
  sonido: number;
  borrador: number;
};

const leer = <T>(json: string, porDefecto: T): T => {
  try {
    return JSON.parse(json) as T;
  } catch {
    return porDefecto;
  }
};

const aEntrada = (f: Fila): Entrada => ({
  ...f,
  herramientas: leer<string[]>(f.herramientas, []),
  prompts: leer<Prompt[]>(f.prompts, []),
  sonido: f.sonido === 1,
  borrador: f.borrador === 1,
});

const COLUMNAS =
  'id, titulo, fecha, herramientas, prompts, notas, video, poster, formato, sonido, tiktok, borrador';

// El Worker se asegura de que la tabla exista (una vez por instancia), así el deploy automático
// no depende de correr migraciones. Mantener igual a migrations/0001_entradas.sql.
let esquema: Promise<unknown> | null = null;
const listo = () =>
  (esquema ??= env.DB.batch([
    env.DB.prepare(
      `CREATE TABLE IF NOT EXISTS entradas (
        id TEXT PRIMARY KEY, titulo TEXT NOT NULL, fecha TEXT NOT NULL,
        herramientas TEXT NOT NULL DEFAULT '[]', prompts TEXT NOT NULL, notas TEXT NOT NULL DEFAULT '',
        video TEXT NOT NULL, poster TEXT, formato TEXT NOT NULL DEFAULT '9:16',
        sonido INTEGER NOT NULL DEFAULT 0, tiktok TEXT, borrador INTEGER NOT NULL DEFAULT 0,
        creado TEXT NOT NULL DEFAULT (datetime('now')), actualizado TEXT NOT NULL DEFAULT (datetime('now'))
      )`,
    ),
    env.DB.prepare('CREATE INDEX IF NOT EXISTS entradas_orden ON entradas (borrador, fecha DESC, creado DESC)'),
  ]).catch((e) => {
    esquema = null; // reintentar en la próxima petición
    throw e;
  }));

export async function listar({ conBorradores = false } = {}): Promise<Entrada[]> {
  await listo();
  const donde = conBorradores ? '' : 'WHERE borrador = 0';
  const { results } = await env.DB.prepare(
    `SELECT ${COLUMNAS} FROM entradas ${donde} ORDER BY fecha DESC, creado DESC`,
  ).all<Fila>();
  return results.map(aEntrada);
}

export async function obtener(id: string): Promise<Entrada | null> {
  await listo();
  const fila = await env.DB.prepare(`SELECT ${COLUMNAS} FROM entradas WHERE id = ?`).bind(id).first<Fila>();
  return fila ? aEntrada(fila) : null;
}

// "Espiral menta" -> "espiral-menta"; si ya existe: "espiral-menta-2", "-3"...
async function idLibre(titulo: string): Promise<string> {
  const base =
    titulo
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'prompt';
  const { results } = await env.DB.prepare('SELECT id FROM entradas WHERE id = ? OR id LIKE ?')
    .bind(base, `${base}-%`)
    .all<{ id: string }>();
  const usados = new Set(results.map((r) => r.id));
  if (!usados.has(base)) return base;
  let n = 2;
  while (usados.has(`${base}-${n}`)) n++;
  return `${base}-${n}`;
}

const valores = (d: DatosEntrada) => [
  d.titulo,
  d.fecha,
  JSON.stringify(d.herramientas),
  JSON.stringify(d.prompts),
  d.notas,
  d.video,
  d.poster,
  d.formato,
  d.sonido ? 1 : 0,
  d.tiktok,
  d.borrador ? 1 : 0,
];

export async function crear(d: DatosEntrada): Promise<string> {
  await listo();
  const id = await idLibre(d.titulo);
  await env.DB.prepare(
    `INSERT INTO entradas (id, titulo, fecha, herramientas, prompts, notas, video, poster, formato, sonido, tiktok, borrador)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(id, ...valores(d))
    .run();
  return id;
}

// Devuelve la versión anterior para poder borrar de R2 los archivos que se reemplazaron.
export async function actualizar(id: string, d: DatosEntrada): Promise<Entrada | null> {
  const antes = await obtener(id);
  if (!antes) return null;
  await env.DB.prepare(
    `UPDATE entradas SET titulo = ?, fecha = ?, herramientas = ?, prompts = ?, notas = ?, video = ?, poster = ?,
       formato = ?, sonido = ?, tiktok = ?, borrador = ?, actualizado = datetime('now')
     WHERE id = ?`,
  )
    .bind(...valores(d), id)
    .run();
  const quitar = [antes.video !== d.video && antes.video, antes.poster !== d.poster && antes.poster].filter(
    (k): k is string => Boolean(k),
  );
  await borrarArchivos(quitar);
  return antes;
}

export async function borrar(id: string): Promise<boolean> {
  const antes = await obtener(id);
  if (!antes) return false;
  await env.DB.prepare('DELETE FROM entradas WHERE id = ?').bind(id).run();
  await borrarArchivos([antes.video, antes.poster].filter((k): k is string => Boolean(k)));
  return true;
}

// Solo borra de R2 los archivos que ya ninguna entrada usa.
async function borrarArchivos(claves: string[]) {
  const huerfanos: string[] = [];
  for (const k of new Set(claves)) {
    if (/^https?:\/\//.test(k)) continue;
    const enUso = await env.DB.prepare('SELECT 1 FROM entradas WHERE video = ? OR poster = ? LIMIT 1').bind(k, k).first();
    if (!enUso) huerfanos.push(k);
  }
  if (huerfanos.length) await env.MEDIA.delete(huerfanos);
}
