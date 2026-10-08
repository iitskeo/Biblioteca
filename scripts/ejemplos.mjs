// Carga los 4 prompts de ejemplo en la base de datos y el almacenamiento LOCALES (no toca producción).
//   npm run ejemplos
import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';

const raiz = resolve(import.meta.dirname, '..');
const ejemplos = JSON.parse(readFileSync(join(raiz, 'ejemplos/ejemplos.json'), 'utf8'));

const wrangler = (...args) => {
  const r = spawnSync('npx', ['wrangler', ...args], { cwd: raiz, stdio: 'inherit', shell: process.platform === 'win32' });
  if (r.status !== 0) process.exit(r.status ?? 1);
};

console.log('\nAplicando el esquema de la base local...');
wrangler('d1', 'migrations', 'apply', 'biblioteca', '--local');

// Mismo texto de búsqueda que calcula el Worker (src/lib/db.ts): minúsculas y sin acentos.
const busqueda = (e) =>
  [e.titulo, ...e.herramientas, ...e.prompts.map((p) => p.texto)]
    .join(' | ')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();

const sql = (v) => (v === null ? 'NULL' : typeof v === 'number' ? String(v) : `'${String(v).replaceAll("'", "''")}'`);
const filas = [];

for (const e of ejemplos) {
  const video = `videos/ejemplo-${e.archivo}.mp4`;
  const poster = `posters/ejemplo-${e.archivo}.webp`;
  console.log(`\nSubiendo ${e.titulo}...`);
  wrangler('r2', 'object', 'put', `biblioteca-media/${video}`, '--file', join('ejemplos/videos', `${e.archivo}.mp4`), '--content-type', 'video/mp4', '--local');
  wrangler('r2', 'object', 'put', `biblioteca-media/${poster}`, '--file', join('ejemplos/posters', `${e.archivo}.webp`), '--content-type', 'image/webp', '--local');
  filas.push(
    `INSERT OR REPLACE INTO entradas (id, titulo, fecha, herramientas, prompts, notas, video, poster, formato, sonido, tiktok, borrador, busqueda) VALUES (${[
      e.id, e.titulo, e.fecha, JSON.stringify(e.herramientas), JSON.stringify(e.prompts), e.notas, video, poster, '9:16', 0, null, 0, busqueda(e),
    ].map(sql).join(', ')});`,
  );
}

const dir = join(tmpdir(), 'biblioteca-ejemplos');
mkdirSync(dir, { recursive: true });
const archivo = join(dir, 'ejemplos.sql');
writeFileSync(archivo, filas.join('\n'));
wrangler('d1', 'execute', 'biblioteca', '--local', '--file', archivo);

console.log('\nListo: 4 ejemplos cargados en local. Corre "npm run dev" y abre http://localhost:4321\n');
