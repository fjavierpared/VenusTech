import { marked } from 'marked';
import { db } from './db';

export interface Publicacion {
  id: number;
  slug: string;
  titulo: string;
  resumen: string;
  contenido: string;
  portada: string | null;
  estado: 'borrador' | 'publicado';
  publicado_en: number | null;
  creado_en: number;
  actualizado_en: number;
  ig_compartir: number;
  ig_texto: string;
  ig_estado: '' | 'publicando' | 'ok' | 'error';
  ig_error: string | null;
  ig_permalink: string | null;
  ig_publicado_en: number | null;
}

export function slugify(texto: string) {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

export function renderMarkdown(md: string) {
  const html = marked.parse(md, { async: false, gfm: true, breaks: true }) as string;
  // Una imagen sola en su párrafo se muestra como foto de revista, con su descripción como pie
  return html.replace(/<p><img src="([^"]+)" alt="([^"]*)"(?: title="[^"]*")?\s*\/?><\/p>/g, (_, src, alt) => {
    const pie = alt && alt !== 'Descripción de la imagen' ? `<figcaption>${alt}</figcaption>` : '';
    return `<figure><img src="${src}" alt="${alt}" loading="lazy">${pie}</figure>`;
  });
}

export function publicadas(limite = 50) {
  return db
    .prepare("SELECT * FROM publicaciones WHERE estado = 'publicado' ORDER BY publicado_en DESC LIMIT ?")
    .all(limite) as unknown as Publicacion[];
}

export function publicadaPorSlug(slug: string) {
  return db.prepare("SELECT * FROM publicaciones WHERE slug = ? AND estado = 'publicado'").get(slug) as
    | Publicacion
    | undefined;
}

export function todas() {
  return db.prepare('SELECT * FROM publicaciones ORDER BY actualizado_en DESC').all() as unknown as Publicacion[];
}

export function porId(id: number) {
  return db.prepare('SELECT * FROM publicaciones WHERE id = ?').get(id) as Publicacion | undefined;
}

export function guardar(datos: {
  id?: number;
  titulo: string;
  slug: string;
  resumen: string;
  contenido: string;
  portada: string | null;
  estado: 'borrador' | 'publicado';
  ig_compartir: boolean;
  ig_texto: string;
}): { ok: true; id: number } | { ok: false; error: string } {
  const titulo = datos.titulo.trim().slice(0, 160);
  const slug = slugify(datos.slug || titulo);
  if (!titulo) return { ok: false, error: 'El título es obligatorio.' };
  if (!slug) return { ok: false, error: 'La URL no es válida.' };
  const choque = db.prepare('SELECT id FROM publicaciones WHERE slug = ? AND id != ?').get(slug, datos.id ?? 0);
  if (choque) return { ok: false, error: 'Ya existe otra publicación con esa URL.' };

  const ahora = Date.now();
  const actual = datos.id ? porId(datos.id) : undefined;
  // La fecha de publicación se fija la primera vez que se publica
  const publicadoEn = datos.estado === 'publicado' ? (actual?.publicado_en ?? ahora) : (actual?.publicado_en ?? null);
  const ig = [datos.ig_compartir ? 1 : 0, datos.ig_texto.trim().slice(0, 2200)] as const;

  if (actual) {
    db.prepare(
      `UPDATE publicaciones SET titulo = ?, slug = ?, resumen = ?, contenido = ?, portada = ?, estado = ?,
       publicado_en = ?, actualizado_en = ?, ig_compartir = ?, ig_texto = ? WHERE id = ?`,
    ).run(titulo, slug, datos.resumen.trim().slice(0, 300), datos.contenido, datos.portada, datos.estado, publicadoEn, ahora, ...ig, actual.id);
    return { ok: true, id: actual.id };
  }
  const r = db
    .prepare(
      `INSERT INTO publicaciones (titulo, slug, resumen, contenido, portada, estado, publicado_en, creado_en, actualizado_en, ig_compartir, ig_texto)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(titulo, slug, datos.resumen.trim().slice(0, 300), datos.contenido, datos.portada, datos.estado, publicadoEn, ahora, ahora, ...ig);
  return { ok: true, id: Number(r.lastInsertRowid) };
}

export function eliminar(id: number) {
  db.prepare('DELETE FROM publicaciones WHERE id = ?').run(id);
}

export function fechaLarga(ts: number) {
  return new Intl.DateTimeFormat('es-VE', { day: 'numeric', month: 'long', year: 'numeric' }).format(ts);
}

export function minutosLectura(md: string) {
  const palabras = md.replace(/<[^>]+>|[#*_>`[\]()!-]/g, ' ').split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(palabras / 200));
}

export function otrasPublicadas(slug: string, limite = 3) {
  return db
    .prepare("SELECT * FROM publicaciones WHERE estado = 'publicado' AND slug != ? ORDER BY publicado_en DESC LIMIT ?")
    .all(slug, limite) as unknown as Publicacion[];
}
