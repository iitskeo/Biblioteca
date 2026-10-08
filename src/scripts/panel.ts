// Panel privado: subir, editar y borrar prompts con su video.
//
// Clave: llega en el link (#clave=...), se guarda en este navegador y viaja en "Authorization".
// Video: se puede optimizar en el navegador (Mediabunny, 720p H.264) y se sube a R2 en partes de 8 MB.
// Portada: el cuadro elegido con el deslizador, como JPG.

type Prompt = { etiqueta: string; texto: string };
type Entrada = {
  id: string;
  titulo: string;
  fecha: string;
  herramientas: string[];
  prompts: Prompt[];
  notas: string;
  video: string;
  poster: string | null;
  formato: string;
  sonido: boolean;
  tiktok: string | null;
  borrador: boolean;
};

const $ = <T extends Element = HTMLElement>(sel: string) => document.querySelector<T>(sel)!;

const CLAVE_LS = 'biblioteca-panel-clave';
const PARTE = 8 * 1024 * 1024;

const ui = {
  acceso: $('[data-acceso]'),
  formClave: $<HTMLFormElement>('[data-form-clave]'),
  inputClave: $<HTMLInputElement>('#clave'),
  errorClave: $('[data-error-clave]'),
  escritorio: $('[data-escritorio]'),
  tituloEditor: $('[data-titulo-editor]'),
  cancelar: $<HTMLButtonElement>('[data-cancelar]'),
  editor: $<HTMLFormElement>('[data-editor]'),
  zona: $('[data-zona]'),
  zonaVacia: $('[data-zona-vacia]'),
  archivo: $<HTMLInputElement>('[data-archivo]'),
  vista: $<HTMLVideoElement>('[data-vista]'),
  portada: $('[data-portada]'),
  cuadro: $<HTMLInputElement>('[data-cuadro]'),
  infoVideo: $('[data-info-video]'),
  opcionOptimizar: $('[data-opcion-optimizar]'),
  optimizar: $<HTMLInputElement>('[data-optimizar]'),
  sonido: $<HTMLInputElement>('[data-sonido]'),
  titulo: $<HTMLInputElement>('[data-titulo]'),
  prompts: $('[data-prompts]'),
  agregarPrompt: $<HTMLButtonElement>('[data-agregar-prompt]'),
  herramientas: $<HTMLInputElement>('[data-herramientas]'),
  sugerencias: $('[data-sugerencias]'),
  tiktok: $<HTMLInputElement>('[data-tiktok]'),
  notas: $<HTMLTextAreaElement>('[data-notas]'),
  fecha: $<HTMLInputElement>('[data-fecha]'),
  publicar: $<HTMLButtonElement>('[data-publicar]'),
  guardarBorrador: $<HTMLButtonElement>('[data-guardar-borrador]'),
  progreso: $('[data-progreso]'),
  progresoRelleno: $('[data-progreso-relleno]'),
  progresoTexto: $('[data-progreso-texto]'),
  error: $('[data-error]'),
  listo: $('[data-listo]'),
  listoTitulo: $('[data-listo-titulo]'),
  listoLink: $<HTMLAnchorElement>('[data-listo-link]'),
  copiarLink: $<HTMLButtonElement>('[data-copiar-link]'),
  otro: $<HTMLButtonElement>('[data-otro]'),
  lista: $('[data-lista]'),
  listaConteo: $('[data-lista-conteo]'),
  listaVacia: $('[data-lista-vacia]'),
  salir: $<HTMLButtonElement>('[data-salir]'),
  tplPrompt: $<HTMLTemplateElement>('[data-tpl-prompt]'),
};

// ---------------------------------------------------------------- estado

let clave = '';
let entradas: Entrada[] = [];
let editando: Entrada | null = null;
let archivo: File | null = null; // video nuevo elegido (si no, se conserva el de la entrada)
let urlVista: string | null = null;
let portadaTocada = false;
let ocupado = false;

// ---------------------------------------------------------------- API

class ErrorApi extends Error {
  constructor(
    mensaje: string,
    public status = 0,
  ) {
    super(mensaje);
  }
}

async function api<T>(ruta: string, opciones: { metodo?: string; json?: unknown } = {}): Promise<T> {
  const res = await fetch(ruta, {
    method: opciones.metodo ?? 'GET',
    headers: {
      authorization: `Bearer ${clave}`,
      ...(opciones.json !== undefined ? { 'content-type': 'application/json' } : {}),
    },
    body: opciones.json !== undefined ? JSON.stringify(opciones.json) : undefined,
  });
  const datos = await res.json().catch(() => ({}));
  if (!res.ok) throw new ErrorApi(datos.error ?? `Algo falló (${res.status}).`, res.status);
  return datos as T;
}

// PUT con progreso de subida (fetch todavía no lo reporta).
function subirBinario<T>(ruta: string, cuerpo: Blob, alAvanzar?: (cargado: number) => void): Promise<T> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', ruta);
    xhr.setRequestHeader('authorization', `Bearer ${clave}`);
    xhr.upload.onprogress = (e) => alAvanzar?.(e.loaded);
    xhr.onload = () => {
      let datos: Record<string, unknown> = {};
      try {
        datos = JSON.parse(xhr.responseText);
      } catch {
        /* respuesta vacía */
      }
      if (xhr.status >= 200 && xhr.status < 300) resolve(datos as T);
      else reject(new ErrorApi(String(datos.error ?? `La subida falló (${xhr.status}).`), xhr.status));
    };
    xhr.onerror = () => reject(new ErrorApi('Se cortó la conexión durante la subida.'));
    xhr.send(cuerpo);
  });
}

// ---------------------------------------------------------------- acceso

function guardarClave(c: string) {
  clave = c;
  try {
    localStorage.setItem(CLAVE_LS, c);
  } catch {
    /* navegador sin almacenamiento: la clave dura solo esta visita */
  }
}

function olvidarClave() {
  clave = '';
  try {
    localStorage.removeItem(CLAVE_LS);
  } catch {
    /* nada que borrar */
  }
}

async function entrar() {
  try {
    const { entradas: lista } = await api<{ entradas: Entrada[] }>('/api/entradas');
    entradas = lista;
    ui.acceso.hidden = true;
    ui.escritorio.hidden = false;
    pintarLista();
    pintarSugerencias();
    if (!ui.prompts.children.length) agregarPrompt();
  } catch (e) {
    if (e instanceof ErrorApi && e.status === 401) olvidarClave();
    ui.escritorio.hidden = true;
    ui.acceso.hidden = false;
    mostrar(ui.errorClave, e instanceof ErrorApi && e.status === 401 ? 'Esa clave no funciona.' : (e as Error).message);
    ui.inputClave.focus();
  }
}

function iniciar() {
  const hash = new URLSearchParams(location.hash.slice(1));
  const deLink = hash.get('clave');
  if (deLink) {
    guardarClave(deLink);
    // Sacar la clave de la barra de direcciones y del historial.
    history.replaceState(null, '', location.pathname);
  } else {
    try {
      clave = localStorage.getItem(CLAVE_LS) ?? '';
    } catch {
      clave = '';
    }
  }
  if (clave) entrar();
  else ui.acceso.hidden = false;
}

ui.formClave.addEventListener('submit', (e) => {
  e.preventDefault();
  const c = ui.inputClave.value.trim();
  if (!c) return;
  ui.errorClave.hidden = true;
  guardarClave(c);
  ui.inputClave.value = '';
  entrar();
});

ui.salir.addEventListener('click', () => {
  olvidarClave();
  location.reload();
});

// ---------------------------------------------------------------- utilidades de UI

function mostrar(el: HTMLElement, texto: string) {
  el.textContent = texto;
  el.hidden = false;
}

function progreso(fraccion: number, texto: string) {
  ui.progreso.hidden = false;
  ui.progresoRelleno.style.transform = `scaleX(${Math.max(0, Math.min(1, fraccion))})`;
  ui.progresoTexto.textContent = texto;
}

const mb = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(1)} MB`;
const pct = (f: number) => `${Math.round(f * 100)}%`;
const duracion = (s: number) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`;

function formatoDe(ancho: number, alto: number) {
  const r = ancho / alto;
  const opciones: [string, number][] = [
    ['9:16', 9 / 16],
    ['4:5', 4 / 5],
    ['1:1', 1],
    ['16:9', 16 / 9],
  ];
  return opciones.sort((a, b) => Math.abs(a[1] - r) - Math.abs(b[1] - r))[0][0];
}

// ---------------------------------------------------------------- prompts (campos dinámicos)

function agregarPrompt(p?: Prompt) {
  const nodo = ui.tplPrompt.content.firstElementChild!.cloneNode(true) as HTMLElement;
  const etiqueta = nodo.querySelector<HTMLInputElement>('.prompt-campo__etiqueta')!;
  const texto = nodo.querySelector<HTMLTextAreaElement>('.prompt-campo__texto')!;
  if (p) {
    etiqueta.value = p.etiqueta;
    texto.value = p.texto;
  } else if (ui.prompts.children.length === 1) {
    // Segundo prompt: lo más común es imagen + video.
    const primero = ui.prompts.querySelector<HTMLInputElement>('.prompt-campo__etiqueta')!;
    if (primero.value === 'Prompt') primero.value = 'Imagen';
    etiqueta.value = 'Video';
  }
  nodo.querySelector('.quitar')!.addEventListener('click', () => nodo.remove());
  ui.prompts.append(nodo);
  return texto;
}

ui.agregarPrompt.addEventListener('click', () => agregarPrompt().focus());

const leerPrompts = (): Prompt[] =>
  [...ui.prompts.querySelectorAll('.prompt-campo')]
    .map((n) => ({
      etiqueta: n.querySelector<HTMLInputElement>('.prompt-campo__etiqueta')!.value.trim() || 'Prompt',
      texto: n.querySelector<HTMLTextAreaElement>('.prompt-campo__texto')!.value.trim(),
    }))
    .filter((p) => p.texto);

// Herramientas usadas antes, para agregarlas con un toque.
function pintarSugerencias() {
  const usadas = [...new Set(entradas.flatMap((e) => e.herramientas))].slice(0, 12);
  ui.sugerencias.replaceChildren(
    ...usadas.map((h) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'sugerencia';
      b.textContent = h;
      b.addEventListener('click', () => {
        const actuales = ui.herramientas.value.split(',').map((s) => s.trim()).filter(Boolean);
        if (!actuales.includes(h)) ui.herramientas.value = [...actuales, h].join(', ');
      });
      return b;
    }),
  );
  ui.sugerencias.hidden = usadas.length === 0;
}

// ---------------------------------------------------------------- video y portada

async function tieneAudio(f: File): Promise<boolean | null> {
  try {
    const { Input, ALL_FORMATS, BlobSource } = await import('mediabunny');
    const input = new Input({ source: new BlobSource(f), formats: ALL_FORMATS });
    return (await input.getAudioTracks()).length > 0;
  } catch {
    return null;
  }
}

function cargarVista(src: string) {
  ui.vista.src = src;
  ui.vista.hidden = false;
  ui.zonaVacia.hidden = true;
  ui.zona.dataset.conVideo = '';
  ui.portada.hidden = false;
}

ui.vista.addEventListener('loadedmetadata', () => {
  const { videoWidth: w, videoHeight: h, duration: d } = ui.vista;
  const partes = [formatoDe(w, h), `${w}×${h}`, Number.isFinite(d) ? duracion(d) : ''];
  if (archivo) partes.push(mb(archivo.size));
  mostrar(ui.infoVideo, partes.filter(Boolean).join('  ·  '));
  moverCuadro();
});

function moverCuadro() {
  const d = ui.vista.duration;
  if (!Number.isFinite(d) || d <= 0) return;
  ui.vista.pause();
  ui.vista.currentTime = (Number(ui.cuadro.value) / 1000) * Math.max(0, d - 0.05);
}
ui.cuadro.addEventListener('input', () => {
  portadaTocada = true;
  moverCuadro();
});

async function elegirArchivo(f: File | undefined) {
  if (!f) return;
  if (!/^video\/(mp4|webm|quicktime)$/.test(f.type) && !/\.(mp4|mov|webm)$/i.test(f.name)) {
    mostrar(ui.error, 'Ese archivo no es un video MP4, MOV o WebM.');
    return;
  }
  ui.error.hidden = true;
  archivo = f;
  portadaTocada = true;
  if (urlVista) URL.revokeObjectURL(urlVista);
  urlVista = URL.createObjectURL(f);
  cargarVista(urlVista);
  ui.opcionOptimizar.hidden = false;
  // Videos chicos y ya livianos no necesitan pasar por el optimizador.
  ui.optimizar.checked = f.size > 6 * 1024 * 1024;
  const audio = await tieneAudio(f);
  if (audio !== null) ui.sonido.checked = audio;
  if (!ui.titulo.value) ui.titulo.value = f.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim().slice(0, 120);
}

ui.archivo.addEventListener('change', () => elegirArchivo(ui.archivo.files?.[0]));
for (const ev of ['dragenter', 'dragover']) {
  ui.zona.addEventListener(ev, (e) => {
    e.preventDefault();
    ui.zona.dataset.arrastrando = '';
  });
}
for (const ev of ['dragleave', 'drop']) {
  ui.zona.addEventListener(ev, () => delete ui.zona.dataset.arrastrando);
}
ui.zona.addEventListener('drop', (e) => {
  e.preventDefault();
  elegirArchivo((e as DragEvent).dataTransfer?.files?.[0]);
});
// Con video cargado, tocarlo lo reproduce/pausa en vez de abrir el selector.
ui.vista.addEventListener('click', (e) => {
  e.preventDefault();
  if (ui.vista.paused) ui.vista.play();
  else ui.vista.pause();
});

function capturarPortada(): Promise<Blob | null> {
  const v = ui.vista;
  if (!v.videoWidth) return Promise.resolve(null);
  const escala = Math.min(1, 1080 / Math.max(v.videoWidth, v.videoHeight));
  const lienzo = document.createElement('canvas');
  lienzo.width = Math.round(v.videoWidth * escala);
  lienzo.height = Math.round(v.videoHeight * escala);
  lienzo.getContext('2d')!.drawImage(v, 0, 0, lienzo.width, lienzo.height);
  return new Promise((r) => lienzo.toBlob((b) => r(b), 'image/jpeg', 0.85));
}

// ---------------------------------------------------------------- optimizar y subir

const par = (n: number) => Math.max(2, Math.round(n / 2) * 2);

async function optimizar(f: File, alAvanzar: (f: number) => void): Promise<Blob | null> {
  const { Input, ALL_FORMATS, BlobSource, Output, Mp4OutputFormat, BufferTarget, Conversion, QUALITY_HIGH } =
    await import('mediabunny');
  const input = new Input({ source: new BlobSource(f), formats: ALL_FORMATS });
  const pista = await input.getPrimaryVideoTrack();
  if (!pista) return null;
  const { displayWidth: w, displayHeight: h } = pista;
  const escala = Math.min(1, 1280 / Math.max(w, h));
  const output = new Output({ format: new Mp4OutputFormat({ fastStart: 'in-memory' }), target: new BufferTarget() });
  const conversion = await Conversion.init({
    input,
    output,
    showWarnings: false,
    video: { width: par(w * escala), height: par(h * escala), fit: 'fill', codec: 'avc', bitrate: QUALITY_HIGH, forceTranscode: true },
    audio: { codec: 'aac', bitrate: 128e3 },
  });
  if (!conversion.isValid) return null;
  conversion.onProgress = alAvanzar;
  await conversion.execute();
  const buffer = output.target.buffer;
  if (!buffer) return null;
  const resultado = new Blob([buffer], { type: 'video/mp4' });
  // Si no ahorró peso, conviene el original.
  return resultado.size < f.size ? resultado : null;
}

async function subirVideo(cuerpo: Blob, ext: string): Promise<string> {
  const { clave: k, uploadId } = await api<{ clave: string; uploadId: string }>('/api/subidas/iniciar', {
    metodo: 'POST',
    json: { ext },
  });
  const total = cuerpo.size;
  const partes: { partNumber: number; etag: string }[] = [];
  try {
    for (let n = 1, desde = 0; desde < total; n++, desde += PARTE) {
      const trozo = cuerpo.slice(desde, Math.min(total, desde + PARTE));
      const ruta = `/api/subidas/parte?clave=${encodeURIComponent(k)}&uploadId=${encodeURIComponent(uploadId)}&n=${n}`;
      let intentos = 0;
      for (;;) {
        try {
          const parte = await subirBinario<{ partNumber: number; etag: string }>(ruta, trozo, (cargado) =>
            progreso((desde + cargado) / total, `Subiendo video… ${pct((desde + cargado) / total)} de ${mb(total)}`),
          );
          partes.push({ partNumber: parte.partNumber, etag: parte.etag });
          break;
        } catch (e) {
          if (++intentos > 2) throw e;
        }
      }
    }
    await api('/api/subidas/terminar', { metodo: 'POST', json: { clave: k, uploadId, partes } });
    return k;
  } catch (e) {
    await api('/api/subidas/abortar', { metodo: 'POST', json: { clave: k, uploadId } }).catch(() => {});
    throw e;
  }
}

// ---------------------------------------------------------------- guardar

function bloquear(si: boolean) {
  ocupado = si;
  for (const el of ui.editor.querySelectorAll<HTMLInputElement | HTMLButtonElement | HTMLTextAreaElement>('input, textarea, button'))
    el.disabled = si;
  ui.cancelar.disabled = si;
}

function validarFormulario(): string | null {
  for (const el of ui.editor.querySelectorAll('[aria-invalid]')) el.removeAttribute('aria-invalid');
  if (!archivo && !editando) return 'Falta el video: arrástralo a la izquierda.';
  if (!ui.titulo.value.trim()) {
    ui.titulo.setAttribute('aria-invalid', 'true');
    ui.titulo.focus();
    return 'Ponle un título.';
  }
  if (!leerPrompts().length) {
    const t = ui.prompts.querySelector<HTMLTextAreaElement>('.prompt-campo__texto');
    t?.setAttribute('aria-invalid', 'true');
    t?.focus();
    return 'Pega al menos un prompt.';
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ui.fecha.value)) return 'Revisa la fecha.';
  return null;
}

async function guardar(borrador: boolean) {
  if (ocupado) return;
  ui.error.hidden = true;
  ui.listo.hidden = true;
  const problema = validarFormulario();
  if (problema) {
    mostrar(ui.error, problema);
    return;
  }

  bloquear(true);
  try {
    let video = editando?.video ?? '';
    let formato = editando?.formato ?? '9:16';
    let poster = editando?.poster ?? null;

    if (archivo) {
      let cuerpo: Blob = archivo;
      let ext = (archivo.name.match(/\.(mp4|mov|webm)$/i)?.[1] ?? 'mp4').toLowerCase();
      if (ui.optimizar.checked) {
        progreso(0, 'Optimizando video…');
        try {
          const optimizado = await optimizar(archivo, (f) => progreso(f, `Optimizando video… ${pct(f)}`));
          if (optimizado) {
            cuerpo = optimizado;
            ext = 'mp4';
          }
        } catch {
          // El navegador no pudo recodificar: se sube el original, que también sirve.
        }
      }
      progreso(0, 'Subiendo video…');
      video = await subirVideo(cuerpo, ext);
      formato = formatoDe(ui.vista.videoWidth, ui.vista.videoHeight);
    }

    if (portadaTocada || !poster) {
      progreso(1, 'Guardando portada…');
      const imagen = await capturarPortada();
      if (imagen) poster = (await subirBinario<{ clave: string }>('/api/subidas/portada?ext=jpg', imagen)).clave;
    }

    progreso(1, 'Guardando…');
    const datos = {
      titulo: ui.titulo.value.trim(),
      fecha: ui.fecha.value,
      herramientas: ui.herramientas.value.split(',').map((s) => s.trim()).filter(Boolean),
      prompts: leerPrompts(),
      notas: ui.notas.value.trim(),
      video,
      poster,
      formato,
      sonido: ui.sonido.checked,
      tiktok: ui.tiktok.value.trim() || null,
      borrador,
    };
    const { id } = editando
      ? await api<{ id: string }>(`/api/entradas/${encodeURIComponent(editando.id)}`, { metodo: 'PUT', json: datos })
      : await api<{ id: string }>('/api/entradas', { metodo: 'POST', json: datos });

    ui.progreso.hidden = true;
    const link = `${location.origin}/p/${id}/`;
    ui.listoTitulo.textContent = borrador
      ? 'Guardado como borrador. No aparece en la web hasta que lo publiques.'
      : editando
        ? 'Cambios publicados.'
        : 'Publicado. Ya está en la biblioteca.';
    ui.listoLink.href = link;
    ui.listoLink.textContent = link;
    ui.listo.hidden = false;
    ui.listo.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    const { entradas: lista } = await api<{ entradas: Entrada[] }>('/api/entradas');
    entradas = lista;
    pintarLista();
    pintarSugerencias();
  } catch (e) {
    ui.progreso.hidden = true;
    mostrar(ui.error, `${(e as Error).message} No se perdió nada de lo que escribiste: puedes intentarlo otra vez.`);
  } finally {
    bloquear(false);
  }
}

ui.editor.addEventListener('submit', (e) => {
  e.preventDefault();
  guardar(false);
});
ui.guardarBorrador.addEventListener('click', () => guardar(true));

window.addEventListener('beforeunload', (e) => {
  if (ocupado) e.preventDefault();
});

// ---------------------------------------------------------------- formulario: limpiar y editar

function limpiarFormulario() {
  editando = null;
  archivo = null;
  portadaTocada = false;
  if (urlVista) URL.revokeObjectURL(urlVista);
  urlVista = null;
  ui.editor.reset();
  ui.fecha.value = new Date().toISOString().slice(0, 10);
  ui.vista.removeAttribute('src');
  ui.vista.load();
  ui.vista.hidden = true;
  ui.zonaVacia.hidden = false;
  delete ui.zona.dataset.conVideo;
  ui.portada.hidden = true;
  ui.infoVideo.hidden = true;
  ui.opcionOptimizar.hidden = true;
  ui.prompts.replaceChildren();
  agregarPrompt();
  ui.error.hidden = true;
  ui.listo.hidden = true;
  ui.progreso.hidden = true;
  ui.tituloEditor.textContent = 'Nuevo prompt';
  ui.publicar.textContent = 'Publicar';
  ui.cancelar.hidden = true;
}

function editar(e: Entrada) {
  limpiarFormulario();
  editando = e;
  ui.tituloEditor.textContent = 'Editar prompt';
  ui.publicar.textContent = 'Guardar y publicar';
  ui.cancelar.hidden = false;
  ui.titulo.value = e.titulo;
  ui.fecha.value = e.fecha;
  ui.herramientas.value = e.herramientas.join(', ');
  ui.tiktok.value = e.tiktok ?? '';
  ui.notas.value = e.notas;
  ui.sonido.checked = e.sonido;
  ui.prompts.replaceChildren();
  for (const p of e.prompts) agregarPrompt(p);
  if (!e.prompts.length) agregarPrompt();
  cargarVista(/^https?:/.test(e.video) ? e.video : `/media/${e.video}`);
  window.scrollTo({ top: 0, behavior: 'smooth' });
  ui.titulo.focus({ preventScroll: true });
}

ui.cancelar.addEventListener('click', limpiarFormulario);
ui.otro.addEventListener('click', () => {
  limpiarFormulario();
  window.scrollTo({ top: 0, behavior: 'smooth' });
});

async function copiarTexto(t: string) {
  try {
    await navigator.clipboard.writeText(t);
    return true;
  } catch {
    return false;
  }
}

ui.copiarLink.addEventListener('click', async () => {
  const ok = await copiarTexto(ui.listoLink.href);
  ui.copiarLink.lastChild!.textContent = ok ? ' Copiado' : ' No se pudo copiar';
  setTimeout(() => (ui.copiarLink.lastChild!.textContent = ' Copiar link'), 1800);
});

// ---------------------------------------------------------------- lista

const fechaCorta = new Intl.DateTimeFormat('es', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });

function boton(texto: string, alClic: (b: HTMLButtonElement) => void) {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'fila__accion';
  b.textContent = texto;
  b.addEventListener('click', () => alClic(b));
  return b;
}

function pintarLista() {
  ui.listaConteo.textContent = entradas.length ? String(entradas.length) : '';
  ui.listaVacia.hidden = entradas.length > 0;
  ui.lista.replaceChildren(
    ...entradas.map((e) => {
      const li = document.createElement('li');
      li.className = 'fila';

      const mini = document.createElement('img');
      mini.className = 'fila__mini';
      mini.alt = '';
      mini.loading = 'lazy';
      if (e.poster) mini.src = /^https?:/.test(e.poster) ? e.poster : `/media/${e.poster}`;

      const texto = document.createElement('div');
      texto.style.minWidth = '0';
      const titulo = document.createElement('a');
      titulo.className = 'fila__titulo';
      titulo.textContent = e.titulo;
      titulo.href = `/p/${e.id}/`;
      titulo.target = '_blank';
      titulo.rel = 'noopener';
      titulo.style.display = 'block';
      const meta = document.createElement('div');
      meta.className = 'fila__meta';
      for (const dato of [
        fechaCorta.format(new Date(`${e.fecha}T00:00:00Z`)).replace('.', ''),
        `${e.prompts.length} ${e.prompts.length === 1 ? 'prompt' : 'prompts'}`,
      ]) {
        const s = document.createElement('span');
        s.textContent = dato;
        meta.append(s);
      }
      if (e.borrador) {
        const b = document.createElement('span');
        b.className = 'fila__borrador';
        b.textContent = 'Borrador';
        meta.append(b);
      }
      texto.append(titulo, meta);

      const acciones = document.createElement('div');
      acciones.className = 'fila__acciones';
      acciones.append(
        boton('Copiar link', async (b) => {
          const ok = await copiarTexto(`${location.origin}/p/${e.id}/`);
          b.textContent = ok ? 'Copiado' : 'No se pudo';
          setTimeout(() => (b.textContent = 'Copiar link'), 1500);
        }),
        boton('Editar', () => editar(e)),
        boton('Borrar', async (b) => {
          // Dos toques para borrar, sin ventanas emergentes.
          if (!('confirmar' in b.dataset)) {
            b.dataset.confirmar = '';
            b.textContent = '¿Seguro? Toca otra vez';
            setTimeout(() => {
              delete b.dataset.confirmar;
              b.textContent = 'Borrar';
            }, 3000);
            return;
          }
          b.disabled = true;
          b.textContent = 'Borrando…';
          try {
            await api(`/api/entradas/${encodeURIComponent(e.id)}`, { metodo: 'DELETE' });
            entradas = entradas.filter((x) => x.id !== e.id);
            if (editando?.id === e.id) limpiarFormulario();
            pintarLista();
          } catch (err) {
            b.disabled = false;
            b.textContent = 'Borrar';
            mostrar(ui.error, (err as Error).message);
          }
        }),
      );

      li.append(mini, texto, acciones);
      return li;
    }),
  );
}

iniciar();
