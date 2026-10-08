// Animaciones de la portada (GSAP + ScrollTrigger + Lenis).
// Solo corren si <html> tiene la clase "anim" (ver Base.astro); si no, la página queda estática.
//
//  1. Entrada: las letras de "itskeo" suben desde su máscara y el video aparece dentro.
//  2. Scroll en la intro: la cámara atraviesa la "k", el video queda a pantalla completa
//     y el manifiesto se ilumina palabra por palabra.
//  3. "Lo más reciente": en escritorio la sección se fija y la pista se desliza en horizontal.
//  4. Biblioteca: las tarjetas entran escalonadas al aparecer.

import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';

const raiz = document.documentElement;

if (raiz.classList.contains('anim')) {
  gsap.registerPlugin(ScrollTrigger);
  ScrollTrigger.config({ ignoreMobileResize: true });

  const lenis = new Lenis({ anchors: true, lerp: 0.11 });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((t) => lenis.raf(t * 1000));
  gsap.ticker.lagSmoothing(0);

  entrada();
  intro();
  reciente();
  biblioteca();

  let espera: number | undefined;
  window.addEventListener('biblioteca:cambio', () => {
    // Al filtrar, lo que queda visible se muestra al instante, sin esperar a la animación de entrada.
    const visibles = gsap.utils.toArray<HTMLElement>('.tarjeta:not([hidden])');
    gsap.killTweensOf(visibles);
    gsap.set(visibles, { opacity: 1, y: 0 });
    clearTimeout(espera);
    espera = window.setTimeout(() => ScrollTrigger.refresh(), 120);
  });
  // Las fuentes cambian medidas: recalcular cuando terminen de cargar.
  document.fonts?.ready.then(() => ScrollTrigger.refresh());
}

function entrada() {
  const tl = gsap.timeline({ defaults: { ease: 'expo.out' } });
  tl.fromTo('.intro__letra > span', { y: 0, yPercent: 115 }, { yPercent: 0, duration: 1.4, stagger: 0.07 }, 0.15)
    .fromTo('[data-intro-video]', { opacity: 0, scale: 1.3 }, { opacity: 1, scale: 1, duration: 2.4 }, 0.1)
    .fromTo('[data-base] > *', { opacity: 0, y: 28 }, { opacity: 1, y: 0, duration: 1.1, stagger: 0.12 }, 0.75)
    .fromTo('.nav', { opacity: 0, y: -16 }, { opacity: 1, y: 0, duration: 1 }, 0.9);
}

function intro() {
  const seccion = document.querySelector<HTMLElement>('[data-intro]');
  const palabra = document.querySelector<HTMLElement>('[data-palabra]');
  // Sin video no hay nada que revelar al atravesar las letras: la intro se queda quieta.
  if (!seccion || !palabra || !document.querySelector('[data-intro-video]')) return;

  // Punto de zoom: el trazo vertical de la "k", para que al acercarse la pantalla se llene de video.
  const letra = palabra.children[3] as HTMLElement | undefined;
  const origen = () => {
    if (!letra) return '50% 50%';
    return `${letra.offsetLeft + letra.offsetWidth * 0.24}px ${letra.offsetTop + letra.offsetHeight * 0.55}px`;
  };

  // La escena es sticky (CSS); el recorrido es todo el alto de la sección.
  const tl = gsap.timeline({
    defaults: { ease: 'none' },
    scrollTrigger: {
      trigger: seccion,
      start: 'top top',
      end: 'bottom bottom',
      scrub: 0.7,
      invalidateOnRefresh: true,
      onRefresh: () => gsap.set(palabra, { transformOrigin: origen() }),
    },
  });

  gsap.set(palabra, { transformOrigin: origen() });

  // Close-up corto: el zoom ocupa poco más de un tercio del recorrido; el resto es el manifiesto.
  tl.to('[data-base]', { opacity: 0, y: -24, duration: 0.08 }, 0)
    .to(palabra, { scale: 30, ease: 'power2.in', duration: 0.3 }, 0)
    .to('[data-mascara]', { opacity: 0, duration: 0.08 }, 0.24)
    .to('[data-tinte]', { opacity: 0, duration: 0.08 }, 0.22)
    .to('[data-intro-video]', { filter: 'blur(3px) saturate(0.9)', duration: 0.1 }, 0.2)
    .to('[data-velo]', { opacity: 1, duration: 0.1 }, 0.28)
    .fromTo('[data-manifiesto]', { opacity: 0, y: 40 }, { opacity: 1, y: 0, duration: 0.08 }, 0.32)
    .to('[data-manifiesto] span', { opacity: 1, duration: 0.04, stagger: 0.024 }, 0.36)
    .to({}, { duration: 0.1 });
}

function reciente() {
  const mm = gsap.matchMedia();
  mm.add('(min-width: 768px)', () => {
    const seccion = document.querySelector<HTMLElement>('[data-reciente]');
    const pista = document.querySelector<HTMLElement>('[data-pista]');
    if (!seccion || !pista) return;

    const distancia = () => Math.max(0, pista.scrollWidth - window.innerWidth);
    const medir = () => seccion.style.setProperty('--recorrido', `${distancia()}px`);
    medir();
    if (distancia() < 40) return;

    // Antes de cada recálculo, ajustar el alto de la sección al ancho real de la pista.
    ScrollTrigger.addEventListener('refreshInit', medir);

    const tween = gsap.to(pista, {
      x: () => -distancia(),
      ease: 'none',
      scrollTrigger: {
        trigger: seccion,
        start: 'top top',
        end: 'bottom bottom',
        scrub: 1,
        invalidateOnRefresh: true,
      },
    });

    return () => {
      ScrollTrigger.removeEventListener('refreshInit', medir);
      seccion.style.removeProperty('--recorrido');
      tween.scrollTrigger?.kill();
      tween.kill();
    };
  });
}

// fromTo con valores finales explícitos: si una entrada se dispara dos veces, nunca se queda a medias.
function biblioteca() {
  gsap.utils.toArray<HTMLElement>('[data-revelar]').forEach((el) => {
    gsap.fromTo(
      el,
      { opacity: 0, y: 24 },
      {
        opacity: 1,
        y: 0,
        duration: 0.7,
        ease: 'expo.out',
        scrollTrigger: { trigger: el, start: 'top 88%', once: true },
      },
    );
  });

  const tarjetas = gsap.utils.toArray<HTMLElement>('.tarjeta');
  gsap.set(tarjetas, { opacity: 0, y: 24 });
  ScrollTrigger.batch(tarjetas, {
    start: 'top 92%',
    once: true,
    onEnter: (lote) =>
      gsap.to(lote, { opacity: 1, y: 0, duration: 0.6, ease: 'expo.out', stagger: 0.05, overwrite: true }),
  });
}
