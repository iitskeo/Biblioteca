// Entradas suaves al hacer scroll, sin librerías: IntersectionObserver + una transición de CSS
// (.revelar / .visible en global.css). La entrada de la intro es CSS puro (index.astro).
// Solo corre si <html> tiene la clase "anim" (ver Base.astro); si no, todo se ve quieto desde el inicio.

const raiz = document.documentElement;

if (raiz.classList.contains('anim') && 'IntersectionObserver' in window) {
  const observador = new IntersectionObserver(
    (entradas) => {
      for (const e of entradas) {
        if (!e.isIntersecting) continue;
        e.target.classList.add('visible');
        observador.unobserve(e.target);
      }
    },
    { rootMargin: '0px 0px -8% 0px' },
  );

  // --orden escalona la entrada de elementos vecinos (50 ms entre cada uno, en grupos de 4).
  const preparar = (elementos: Iterable<HTMLElement>) => {
    let n = 0;
    for (const el of elementos) {
      if (el.dataset.revelado) continue;
      el.dataset.revelado = '1';
      el.style.setProperty('--orden', String(n++ % 4));
      el.classList.add('revelar');
      observador.observe(el);
    }
  };

  preparar(document.querySelectorAll<HTMLElement>('[data-revelar], .tarjeta'));
  // Tarjetas nuevas al buscar o cambiar de página.
  window.addEventListener('biblioteca:cambio', () => preparar(document.querySelectorAll<HTMLElement>('.tarjeta')));
}
