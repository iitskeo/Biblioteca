// Búsqueda y filtro por categoría. Filtros compartibles: /?q=espiral o /?c=gradientes
import { normalizar } from '../lib/normalizar';

const input = document.querySelector<HTMLInputElement>('#q');
const chips = [...document.querySelectorAll<HTMLButtonElement>('[data-filtro]')];
const tarjetas = [...document.querySelectorAll<HTMLElement>('.tarjeta')];
const conteo = document.querySelector<HTMLElement>('[data-conteo]');
const vacio = document.querySelector<HTMLElement>('[data-vacio]');
const anuncio = document.querySelector<HTMLElement>('[data-anuncio]');
const limpiar = document.querySelector<HTMLButtonElement>('[data-limpiar]');

let filtro = '';

function aplicar() {
  const terminos = normalizar(input?.value ?? '')
    .split(/\s+/)
    .filter(Boolean);
  let visibles = 0;
  for (const t of tarjetas) {
    const ok =
      (!filtro || t.dataset.categoria === filtro) && terminos.every((w) => (t.dataset.buscar ?? '').includes(w));
    t.hidden = !ok;
    if (ok) visibles++;
  }
  if (conteo) conteo.textContent = String(visibles);
  if (vacio) vacio.hidden = visibles > 0;
  if (anuncio) anuncio.textContent = `${visibles} ${visibles === 1 ? 'prompt' : 'prompts'}`;

  const url = new URL(location.href);
  input?.value ? url.searchParams.set('q', input.value) : url.searchParams.delete('q');
  filtro ? url.searchParams.set('c', filtro) : url.searchParams.delete('c');
  history.replaceState(null, '', url);

  // La altura de la página cambió: las animaciones con scroll recalculan posiciones.
  window.dispatchEvent(new Event('biblioteca:cambio'));
}

function elegir(valor: string) {
  filtro = chips.some((c) => c.dataset.filtro === valor) ? valor : '';
  for (const c of chips) c.setAttribute('aria-pressed', String(c.dataset.filtro === filtro));
}

input?.addEventListener('input', aplicar);
for (const c of chips) {
  c.addEventListener('click', () => {
    elegir(c.dataset.filtro ?? '');
    aplicar();
  });
}
limpiar?.addEventListener('click', () => {
  if (input) input.value = '';
  elegir('');
  aplicar();
  input?.focus();
});

const params = new URLSearchParams(location.search);
if (params.has('q') || params.has('c')) {
  if (input) input.value = params.get('q') ?? '';
  elegir(params.get('c') ?? '');
  aplicar();
}
