// Reproducción de videos:
//  data-play="auto"  -> se reproduce cuando entra en pantalla (hero, página de detalle)
//  data-play="hover" -> en escritorio al pasar el mouse; en celular cuando está casi completo en pantalla
// Con "reducir movimiento" activado nada se reproduce solo: se queda el poster hasta que lo pidas.

// La clase "anim" la pone el <head> (ver Base.astro) cuando el movimiento está permitido.
const reducir = { get matches() { return !document.documentElement.classList.contains('anim'); } };
const conMouse = matchMedia('(hover: hover) and (pointer: fine)');

function reproducir(v: HTMLVideoElement) {
  if (v.preload === 'none') v.preload = 'auto';
  v.play().catch(() => {
    /* el navegador bloqueó el autoplay: se queda el poster */
  });
}

function seReproduceSolo(v: HTMLVideoElement) {
  if (reducir.matches || v.dataset.pausado) return false;
  return v.dataset.play === 'auto' || !conMouse.matches;
}

// Los "auto" arrancan con un tercio visible (pueden ser más altos que la pantalla);
// las tarjetas en celular esperan a estar casi completas para no reproducir media rejilla a la vez.
const umbral = (v: HTMLVideoElement) => (v.dataset.play === 'auto' ? 0.35 : 0.6);

const observador = new IntersectionObserver(
  (entradas) => {
    for (const e of entradas) {
      const v = e.target as HTMLVideoElement;
      if (e.intersectionRatio >= umbral(v)) {
        if (seReproduceSolo(v) && v.paused) reproducir(v);
      } else if (!v.paused && e.intersectionRatio < 0.2) {
        v.pause();
      }
    }
  },
  { threshold: [0, 0.2, 0.35, 0.6] },
);

for (const v of document.querySelectorAll<HTMLVideoElement>('video[data-play]')) {
  observador.observe(v);

  if (v.dataset.play === 'hover') {
    const anfitrion = v.closest<HTMLElement>('[data-hover]') ?? v;
    anfitrion.addEventListener('pointerenter', (e) => {
      if (e.pointerType === 'mouse') reproducir(v);
    });
    anfitrion.addEventListener('pointerleave', (e) => {
      if (e.pointerType === 'mouse') v.pause();
    });
    anfitrion.addEventListener('focusin', () => reproducir(v));
    anfitrion.addEventListener('focusout', () => v.pause());
  }
}
