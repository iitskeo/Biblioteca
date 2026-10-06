// Minúsculas y sin acentos, para que "animacion" encuentre "animación". Se usa en servidor y navegador.
export const normalizar = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
