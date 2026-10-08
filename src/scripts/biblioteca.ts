// Biblioteca: búsqueda por palabras dentro de los prompts y páginas numeradas de 24.
//
// La búsqueda la hace el servidor sobre TODOS los prompts (D1), así funciona igual con 10 o con 1000.
// "nike" trae los que dicen nike; "16:9" los que tienen 16:9 escrito; varias palabras = todas deben aparecer.
// En la página nunca hay más de 24 tarjetas: cambiar de página reemplaza la rejilla (no se acumulan).
// Cada tarjeta que coincide muestra el pedazo del prompt donde está la palabra, resaltada.
// Links compartibles: /?q=nike  /?pagina=3
import { normalizar } from '../lib/normalizar';
import { observarVideos } from './videos';

const input = document.querySelector<HTMLInputElement>('#q');
const rejilla = document.querySelector<HTMLElement>('[data-rejilla]');
const conteo = document.querySelector<HTMLElement>('[data-conteo]');
const vacio = document.querySelector<HTMLElement>('[data-vacio]');
const vacioQ = document.querySelector<HTMLElement>('[data-vacio-q]');
const anuncio = document.querySelector<HTMLElement>('[data-anuncio]');
const limpiar = document.querySelector<HTMLButtonElement>('[data-limpiar]');
const paginacion = document.querySelector<HTMLElement>('[data-paginacion]');
const seccion = document.querySelector<HTMLElement>('#biblioteca');

let consulta = input?.value.trim() ?? '';
let numero = Number(rejilla?.dataset.pagina) || 1;
let pedido: AbortController | null = null;

// ---------------------------------------------------------------- fragmentos resaltados

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

function resaltar(tarjetas: Iterable<HTMLElement>) {
  const terminos = normalizar(consulta).split(/\s+/).filter(Boolean);
  for (const t of tarjetas) {
    const caja = t.querySelector<HTMLElement>('[data-fragmento]');
    if (!caja) continue;
    const frag = terminos.length ? fragmento(t.dataset.texto ?? '', terminos) : null;
    caja.replaceChildren(...(frag ? [frag] : []));
    caja.hidden = !frag;
  }
}

// ---------------------------------------------------------------- pedir una página al servidor

async function pedir(n: number) {
  pedido?.abort();
  pedido = new AbortController();
  const params = new URLSearchParams({ q: consulta, pagina: String(n) });
  rejilla?.setAttribute('aria-busy', 'true');
  try {
    const res = await fetch(`/fragmentos/tarjetas?${params}`, { signal: pedido.signal });
    if (!res.ok) throw new Error(String(res.status));
    const plantilla = document.createElement('template');
    plantilla.innerHTML = await res.text();
    const tarjetas = [...plantilla.content.querySelectorAll<HTMLElement>('.tarjeta')];
    const nav = plantilla.content.querySelector('[data-paginas]');
    const total = Number(res.headers.get('x-total') ?? 0);

    numero = n;
    rejilla?.replaceChildren(...tarjetas);
    for (const t of tarjetas) observarVideos(t);
    resaltar(tarjetas);
    paginacion?.replaceChildren(...(nav ? [nav] : []));

    if (conteo) conteo.textContent = String(total);
    if (vacio) vacio.hidden = total > 0;
    if (vacioQ) vacioQ.textContent = `«${consulta}»`;
    if (anuncio) anuncio.textContent = `${total} ${total === 1 ? 'prompt' : 'prompts'}${n > 1 ? `, página ${n}` : ''}`;
    // La altura de la página cambió: las animaciones con scroll recalculan posiciones.
    window.dispatchEvent(new Event('biblioteca:cambio'));
    return true;
  } catch (e) {
    if ((e as Error).name !== 'AbortError' && anuncio) anuncio.textContent = 'No se pudieron cargar los prompts. Revisa tu conexión.';
    return false;
  } finally {
    rejilla?.removeAttribute('aria-busy');
  }
}

function direccion(n: number) {
  const url = new URL(location.href);
  consulta ? url.searchParams.set('q', consulta) : url.searchParams.delete('q');
  n > 1 ? url.searchParams.set('pagina', String(n)) : url.searchParams.delete('pagina');
  url.hash = '';
  return url;
}

async function buscar() {
  consulta = (input?.value ?? '').trim();
  if (await pedir(1)) history.replaceState(null, '', direccion(1));
}

async function irA(n: number) {
  if (!(await pedir(n))) return;
  history.pushState(null, '', direccion(n));
  // Volver al principio de la biblioteca, no al de la página.
  const y = (seccion?.getBoundingClientRect().top ?? 0) + window.scrollY - 72;
  window.scrollTo({ top: y, behavior: 'smooth' });
}

// ---------------------------------------------------------------- eventos

// Escribir rápido no debe pedir al servidor en cada tecla.
let espera: number | undefined;
input?.addEventListener('input', () => {
  clearTimeout(espera);
  espera = window.setTimeout(buscar, 250);
});
input?.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && input.value) {
    input.value = '';
    buscar();
  }
});
limpiar?.addEventListener('click', () => {
  if (input) input.value = '';
  buscar();
  input?.focus();
});

// Los números de página son links reales; con JavaScript solo se cambia la rejilla.
paginacion?.addEventListener('click', (e) => {
  const link = (e.target as Element).closest<HTMLAnchorElement>('a[data-pagina]');
  if (!link || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
  e.preventDefault();
  irA(Number(link.dataset.pagina));
});

// Atrás / adelante del navegador entre páginas.
window.addEventListener('popstate', () => {
  const p = new URLSearchParams(location.search);
  consulta = p.get('q') ?? '';
  if (input) input.value = consulta;
  pedir(Math.max(1, Number(p.get('pagina')) || 1));
});

// Estado inicial: la página ya vino del servidor (filtrada si había ?q=).
if (consulta && rejilla) resaltar(rejilla.querySelectorAll<HTMLElement>('.tarjeta'));
