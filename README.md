# Biblioteca de prompts de @itskeo5

Cada video que subo a TikTok, con el prompt exacto que lo generó. Astro sobre Cloudflare Workers: los datos viven en **D1** y los videos en **R2**, así que lo que subes desde el panel aparece al instante, sin tocar código.

## Subir un prompt

1. Abre tu link privado del panel: `https://<tu-dominio>/panel#clave=…`
2. Arrastra el video, mueve el deslizador para elegir la portada.
3. Pon título, pega el prompt (o varios: imagen, video, negativo…), herramientas y, si quieres, el link del TikTok y cómo lo hiciste.
4. **Publicar**. Te da el link de esa página para ponerlo en el TikTok.

Desde la misma lista puedes **editar**, **borrar** (dos toques) o **copiar el link** de cualquier prompt. "Guardar como borrador" lo deja oculto de la web.

El panel optimiza el video en tu navegador (720p, H.264) antes de subirlo cuando pesa más de 6 MB; si el resultado no es más liviano, sube el original. Los videos se suben en partes, así que no hay límite práctico de tamaño.

### La clave del panel

- No hay usuario ni contraseña: el panel funciona con una clave larga que va en el link, después de `#`. Esa parte nunca viaja al servidor ni queda en registros.
- La clave vive como **secreto en Cloudflare** (`PANEL_CLAVE`), no en el código ni en el repo. Toda la API rechaza cualquier petición sin ella.
- El navegador la recuerda después de entrar una vez. "Olvidar la clave en este navegador" la borra.
- **Si el link se filtra**, genera otra clave con `npm run clave`: el link anterior deja de servir al instante.

## Búsqueda

No hay categorías: se busca por palabras dentro del texto de los prompts (y el título y las herramientas). "nike" muestra los que dicen nike; "16:9" los que tienen 16:9 escrito. Cada resultado muestra el pedazo del prompt donde aparece la palabra, resaltada. Se puede compartir una búsqueda: `/?q=nike`.

## Primera publicación en Cloudflare

```bash
npx wrangler login
```

```bash
npm run deploy
```

La primera vez, wrangler crea la base de datos D1 (`biblioteca`) y el bucket R2 (`biblioteca-media`) en tu cuenta y aplica el esquema. R2 requiere tenerlo activado en tu cuenta de Cloudflare (tiene un plan gratis generoso).

Después, crea la clave del panel y guarda el link que te imprime:

```bash
npm run clave
```

Cuando tengas el dominio final, ponlo en `astro.config.mjs` (`site`) y corre `SITE_URL=https://tu-dominio npm run clave` si quieres el link con ese dominio.

## Trabajar en local

```bash
npm install
```

```bash
npm run ejemplos
```

```bash
npm run dev
```

`npm run ejemplos` carga 4 prompts de ejemplo en la base y el almacenamiento **locales** (no toca producción). La clave local del panel está en `.dev.vars` (no se sube al repo): abre `http://localhost:4321/panel#clave=<esa clave>`.

## Animaciones de la portada

La intro (video dentro de "itskeo", zoom a través de la "k", manifiesto) y la galería horizontal están en `src/scripts/inicio.ts` (GSAP + ScrollTrigger + Lenis). El video de la intro es siempre el prompt vertical más reciente.

Si el sistema tiene activado "reducir movimiento" (en Windows: *Configuración → Accesibilidad → Efectos visuales → Efectos de animación* apagado), la página se muestra estática a propósito. Para verlas igual: `?movimiento=1` (y `?movimiento=0` para volver).

## Estructura

| Ruta | Qué es |
| --- | --- |
| `src/pages/index.astro` | Portada: intro, lo más reciente y la biblioteca con buscador |
| `src/pages/p/[id].astro` | Página de cada prompt |
| `src/pages/panel.astro` + `src/scripts/panel.ts` | Panel privado |
| `src/pages/api/` | API del panel (entradas y subidas), protegida con la clave |
| `src/pages/media/[...clave].ts` | Sirve videos y portadas desde R2 (con soporte de Range) |
| `src/lib/db.ts` | Lectura y escritura en D1 |
| `migrations/` | Esquema de la base de datos |
| `ejemplos/` | Videos y datos de ejemplo para desarrollo local |
