// Genera una clave nueva para el panel, la guarda como secreto en Cloudflare y te da el link.
//   npm run clave
// Úsalo la primera vez y cada vez que sospeches que el link se filtró: el link anterior deja de servir.
import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { resolve } from 'node:path';

const raiz = resolve(import.meta.dirname, '..');
const sitio = (process.env.SITE_URL || 'https://biblioteca.kene00vargas.workers.dev').replace(/\/$/, '');
const clave = randomBytes(24).toString('base64url');

console.log('\nGuardando la clave nueva en Cloudflare (secreto PANEL_CLAVE)...');
const r = spawnSync('npx', ['wrangler', 'secret', 'put', 'PANEL_CLAVE'], {
  cwd: raiz,
  input: `${clave}\n`,
  stdio: ['pipe', 'inherit', 'inherit'],
  shell: process.platform === 'win32',
});
if (r.status !== 0) {
  console.error('\nNo se pudo guardar. ¿Iniciaste sesión con "npx wrangler login"?\n');
  process.exit(1);
}

console.log(`
Listo. Este es tu link privado del panel (guárdalo en un lugar seguro, no lo compartas):

  ${sitio}/panel#clave=${clave}

Lo que va después de "#" nunca viaja al servidor ni queda en registros.
`);
