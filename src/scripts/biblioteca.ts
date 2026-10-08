// Búsqueda por palabras dentro de los prompts.
// "nike" muestra los prompts que dicen nike; "16:9" los que tienen 16:9 escrito. Varias palabras = todas deben aparecer.
// Cada tarjeta que coincide muestra el pedazo del prompt donde está la palabra, resaltada.
// Link compartible: /?q=nike
import { normalizar } from '../lib/normalizar';

const input = document.querySelector<HTMLInputElement>('#q');
const tarjetas = [...document.querySelectorAll<HTMLElement>('.tarjeta')];
const conteo = document.querySelector<HTMLElement>('[data-conteo]');
const vacio = document.querySelector<HTMLElement>('[data-vacio]');
const vacioQ = document.querySelector<HTMLElement>('[data-vacio-q]');
const anuncio = document.querySelector<HTMLElement>('[data-anuncio]');
const limpiar = document.querySelector<HTMLButtonElement>('[data-limpiar]');

let textos: Record<string, string> = {};
try {
  textos = JSON.parse(document.getElementById('textos')?.textContent ?? '{}');
} catch {
  /* sin fragmentos, la búsqueda igual funciona */
}

// Normaliza carácter por carácter para que las posiciones coincidan con el texto original.
const normalizarAlineado = (s: string) => [...s].map((c) => normalizar(c)[0] ?? c).join('');

function fragmento(texto: string, terminos: string[]): DocumentFragment | null {
  const plano = normalizarAlineado(texto);
  const primero = terminos.map((t) => plano.indexOf(t)).filter((i) => i >= 0).sort((a, b) => a - b)[0];
  if (primero === undefined) return null;

  const desde = Math.max(0, primero - 50);
  const hasta = Math.min(texto.length, primero + 130);
  const recorte = texto.slice(desde, hasta).replace(/\s+/g, ' ');
  const recortePlano = normalizarAlineado(recorte);

  // Marcar todas las apariciones de todos los términos dentro del recorte.
  const marcas: [number, number][] = [];
  for (const t of terminos) {
    for (let i = recortePlano.indexOf(t); i >= 0; i = recortePlano.indexOf(t, i + t.length)) marcas.push([i, i + t.length]);
  }
  marcas.sort((a, b) => a[0] - b[0]);

  const frag = document.createDocumentFragment();
  if (desde > 0) frag.append('…');
  let pos = 0;
  for (const [a, b] of marcas) {
    if (a < pos) continue;
    frag.append(recorte.slice(pos, a));
    const mark = document.createElement('mark');
    mark.textContent = recorte.slice(a, b);
    frag.append(mark);
    pos = b;
  }
  frag.append(recorte.slice(pos));
  if (hasta < texto.length) frag.append('…');
  return frag;
}

function aplicar() {
  const consulta = (input?.value ?? '').trim();
  const terminos = normalizar(consulta).split(/\s+/).filter(Boolean);
  let visibles = 0;

  for (const t of tarjetas) {
    const ok = terminos.every((w) => (t.dataset.buscar ?? '').includes(w));
    t.hidden = !ok;
    if (ok) visibles++;

    const caja = t.querySelector<HTMLElement>('[data-fragmento]');
    if (!caja) continue;
    const frag = ok && terminos.length ? fragmento(textos[t.dataset.id ?? ''] ?? '', terminos) : null;
    caja.replaceChildren(...(frag ? [frag] : []));
    caja.hidden = !frag;
  }

  if (conteo) conteo.textContent = String(visibles);
  if (vacio) vacio.hidden = visibles > 0;
  if (vacioQ) vacioQ.textContent = `«${consulta}»`;
  if (anuncio) anuncio.textContent = `${visibles} ${visibles === 1 ? 'prompt' : 'prompts'}`;

  const url = new URL(location.href);
  consulta ? url.searchParams.set('q', consulta) : url.searchParams.delete('q');
  history.replaceState(null, '', url);

  // La altura de la página cambió: las animaciones con scroll recalculan posiciones.
  window.dispatchEvent(new Event('biblioteca:cambio'));
}

// Escribir rápido no debe recalcular en cada tecla.
let espera: number | undefined;
input?.addEventListener('input', () => {
  clearTimeout(espera);
  espera = window.setTimeout(aplicar, 120);
});
input?.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && input.value) {
    input.value = '';
    aplicar();
  }
});
limpiar?.addEventListener('click', () => {
  if (input) input.value = '';
  aplicar();
  input?.focus();
});

const inicial = new URLSearchParams(location.search).get('q');
if (inicial && input) {
  input.value = inicial;
  aplicar();
}
