# Biblioteca de prompts de @itskeo5

Cada video que subo a TikTok, con el prompt exacto que lo generó. Sitio estático hecho con [Astro](https://astro.build) y publicado en Cloudflare Workers.

## Agregar un video nuevo

```bash
npm run nuevo -- "Título del video" "C:\ruta\al\video.mp4"
```

Esto comprime el video (menos de 25 MB, lado largo 1280px), saca el poster, detecta el formato y si tiene audio, y crea `src/content/prompts/titulo-del-video.md` en **borrador**.

Después:

1. Abre el `.md`, pon la categoría, las herramientas y pega tus prompts.
2. Cambia `borrador: true` a `borrador: false`.
3. `git add . && git commit -m "Título del video" && git push`

Cloudflare publica solo en un par de minutos. La página queda en `/p/titulo-del-video/`; ese es el link para compartir en TikTok.

### Campos de cada entrada

| Campo | Qué es |
| --- | --- |
| `titulo` | Nombre que aparece en la web |
| `fecha` | `2026-10-06`. Ordena la biblioteca, lo más nuevo primero |
| `categoria` | Tipo de video: `Abstracto`, `Logos`, `Personajes`... Es el filtro de la biblioteca; inventa las que quieras |
| `herramientas` | `["Midjourney v7", "Kling 2.5"]`. Aparecen en la página del prompt como "Hecho con" |
| `video` | `/videos/archivo.mp4` o una URL completa (por ejemplo, R2) |
| `poster` | Imagen fija mientras carga el video |
| `formato` | `9:16`, `16:9`, `1:1` o `4:5`. Los `16:9` ocupan doble ancho |
| `sonido` | `true` muestra el botón de sonido |
| `tiktok` | Link al video en TikTok (opcional) |
| `prompts` | Lista de `etiqueta` + `texto`. Puedes poner los que quieras (Imagen, Video, Negativo...) |
| `borrador` | `true` = solo se ve en local con `npm run dev` |

El texto debajo del segundo `---` son las notas (markdown), y es opcional.

## Animaciones de la portada

La intro (video dentro de las letras, zoom a través de la "k", manifiesto) y la galería horizontal están en `src/scripts/inicio.ts` (GSAP + ScrollTrigger + Lenis). El video de la intro es siempre la entrada vertical más reciente.

Si el sistema tiene activado "reducir movimiento" (en Windows: *Configuración → Accesibilidad → Efectos visuales → Efectos de animación* apagado), la página se muestra estática a propósito. Para verlas igual: abre la web con `?movimiento=1`; `?movimiento=0` lo devuelve a lo normal.

## Trabajar en local

```bash
npm install
npm run dev
```

Abre http://localhost:4321.

## Publicación (Cloudflare)

El proyecto es un Worker con assets estáticos (`wrangler.jsonc` sirve la carpeta `dist/`).

- **Automático:** en Cloudflare, *Workers & Pages → Create → Import a repository*, elige `biblioteca`. Build command `npm run build`, deploy command `npx wrangler deploy`. Cada `git push` publica.
- **Manual:** `npm run deploy` (pide `npx wrangler login` la primera vez).

Cuando tengas el dominio final, cámbialo en `astro.config.mjs` (`site`) para que las vistas previas al compartir salgan bien.

### Videos pesados

Cloudflare acepta archivos de hasta 25 MB. `npm run nuevo` comprime para quedar debajo. Si algún día hay muchos videos o son largos, súbelos a un bucket de R2 y pon la URL completa en `video:`.

## Ejemplos

Las entradas `espiral-menta`, `fractal-infinito`, `colonia` y `alfombra-cuantica` son de ejemplo, con videos generados con ffmpeg. Bórralas (el `.md`, el video y el poster) cuando subas los tuyos.
