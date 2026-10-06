// Crea una entrada nueva en la biblioteca a partir de un video.
//
//   npm run nuevo -- "Título del video" "C:\ruta\al\video.mp4"
//
// 1. Comprime el video para web (H.264, lado largo 1280px, < 25 MB, límite de Cloudflare).
// 2. Saca un poster .webp.
// 3. Detecta formato (9:16, 16:9...) y si trae audio.
// 4. Crea src/content/prompts/<slug>.md en borrador, listo para pegar los prompts.

import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, statSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const LIMITE = 24 * 1024 * 1024; // margen bajo los 25 MiB por archivo de Cloudflare
const raiz = resolve(import.meta.dirname, '..');

const [titulo, origen] = process.argv.slice(2);
if (!titulo || !origen) {
  console.log('\nUso: npm run nuevo -- "Título del video" "ruta/al/video.mp4"\n');
  process.exit(1);
}
if (!existsSync(origen)) {
  console.error(`\nNo encuentro el video: ${origen}\n`);
  process.exit(1);
}

const slug = titulo
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '');

const md = join(raiz, 'src/content/prompts', `${slug}.md`);
const destinoVideo = join(raiz, 'public/videos', `${slug}.mp4`);
const destinoPoster = join(raiz, 'public/posters', `${slug}.webp`);

if (existsSync(md)) {
  console.error(`\nYa existe una entrada llamada "${slug}". Usa otro título.\n`);
  process.exit(1);
}
mkdirSync(join(raiz, 'public/videos'), { recursive: true });
mkdirSync(join(raiz, 'public/posters'), { recursive: true });

const hay = (cmd) => spawnSync(cmd, ['-version'], { stdio: 'ignore' }).status === 0;
const correr = (cmd, args) => spawnSync(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'], encoding: 'utf8' });

let formato = '9:16';
let sonido = false;
let poster = false;

if (hay('ffprobe')) {
  const info = JSON.parse(
    correr('ffprobe', ['-v', 'error', '-show_entries', 'stream=codec_type,width,height', '-of', 'json', origen]).stdout ||
      '{"streams":[]}',
  );
  const v = info.streams.find((s) => s.codec_type === 'video');
  sonido = info.streams.some((s) => s.codec_type === 'audio');
  if (v?.width && v?.height) {
    const r = v.width / v.height;
    const opciones = { '9:16': 9 / 16, '4:5': 4 / 5, '1:1': 1, '16:9': 16 / 9 };
    formato = Object.entries(opciones).sort((a, b) => Math.abs(a[1] - r) - Math.abs(b[1] - r))[0][0];
  }
}

if (hay('ffmpeg')) {
  console.log('\nComprimiendo video...');
  for (const crf of [23, 27, 31, 35]) {
    const r = correr('ffmpeg', [
      '-y', '-hide_banner', '-loglevel', 'error',
      '-i', origen,
      '-vf', 'scale=1280:1280:force_original_aspect_ratio=decrease:force_divisible_by=2',
      '-c:v', 'libx264', '-preset', 'slow', '-crf', String(crf), '-pix_fmt', 'yuv420p',
      ...(sonido ? ['-c:a', 'aac', '-b:a', '128k'] : ['-an']),
      '-movflags', '+faststart',
      destinoVideo,
    ]);
    if (r.status !== 0) {
      console.error(r.stderr);
      process.exit(1);
    }
    const mb = statSync(destinoVideo).size / 1024 / 1024;
    if (statSync(destinoVideo).size <= LIMITE) {
      console.log(`  listo: ${mb.toFixed(1)} MB (calidad crf ${crf})`);
      break;
    }
    if (crf === 35) {
      console.warn(`  Ojo: sigue pesando ${mb.toFixed(1)} MB. Cloudflare no acepta archivos de más de 25 MB; recórtalo o súbelo a R2.`);
    }
  }

  const p = correr('ffmpeg', [
    '-y', '-hide_banner', '-loglevel', 'error',
    '-ss', '1', '-i', destinoVideo, '-frames:v', '1',
    '-vf', 'scale=960:960:force_original_aspect_ratio=decrease',
    '-c:v', 'libwebp', '-quality', '78',
    destinoPoster,
  ]);
  poster = p.status === 0;
} else {
  console.warn('\nNo encontré ffmpeg: copio el video tal cual, sin comprimir ni poster.');
  copyFileSync(origen, destinoVideo);
  if (statSync(destinoVideo).size > LIMITE) {
    console.warn('  Ojo: pesa más de 25 MB y Cloudflare no lo va a aceptar.');
  }
}

const hoy = new Date().toISOString().slice(0, 10);
const plantilla = `---
titulo: ${JSON.stringify(titulo)}
fecha: ${hoy}
# Tipo de video. Es el filtro de la biblioteca (Abstracto, Logos, Personajes, Transiciones...)
categoria: Varios
herramientas: ["Midjourney v7", "Kling 2.5"]
video: /videos/${slug}.mp4
${poster ? `poster: /posters/${slug}.webp\n` : ''}formato: "${formato}"
sonido: ${sonido}
# tiktok: https://www.tiktok.com/@itskeo5/video/...
prompts:
  - etiqueta: Imagen
    texto: >-
      Pega aquí el prompt de imagen
  - etiqueta: Video
    texto: >-
      Pega aquí el prompt de video
# Cambia a false cuando esté listo para publicarse
borrador: true
---

Notas opcionales: qué ajustaste, qué no funcionó, trucos. Si no quieres notas, borra este párrafo.
`;

writeFileSync(md, plantilla);

console.log(`
Entrada creada: src/content/prompts/${slug}.md
  formato ${formato}${sonido ? ', con audio' : ', sin audio'}

Siguiente:
  1. Abre el .md, pon la categoría, las herramientas y pega tus prompts.
  2. Cambia "borrador: true" a "borrador: false".
  3. Súbelo:  git add . && git commit -m "${titulo}" && git push
`);
