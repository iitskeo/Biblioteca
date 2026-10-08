-- Cada fila es un video de la biblioteca con sus prompts.
-- Idéntico al esquema que crea el Worker al arrancar (src/lib/db.ts): IF NOT EXISTS para que ambos convivan.
CREATE TABLE IF NOT EXISTS entradas (
  id           TEXT PRIMARY KEY,                    -- slug de la URL: /p/<id>/
  titulo       TEXT NOT NULL,
  fecha        TEXT NOT NULL,                       -- AAAA-MM-DD, ordena la biblioteca
  herramientas TEXT NOT NULL DEFAULT '[]',          -- JSON: ["Midjourney v7", "Kling 2.5"]
  prompts      TEXT NOT NULL,                       -- JSON: [{"etiqueta": "Video", "texto": "..."}]
  notas        TEXT NOT NULL DEFAULT '',
  video        TEXT NOT NULL,                       -- clave en R2: videos/....mp4
  poster       TEXT,                                -- clave en R2: posters/....jpg
  formato      TEXT NOT NULL DEFAULT '9:16',
  sonido       INTEGER NOT NULL DEFAULT 0,
  tiktok       TEXT,
  borrador     INTEGER NOT NULL DEFAULT 0,
  creado       TEXT NOT NULL DEFAULT (datetime('now')),
  actualizado  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS entradas_orden ON entradas (borrador, fecha DESC, creado DESC);
