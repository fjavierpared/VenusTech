import { randomBytes } from 'node:crypto';
import { writeFile, unlink } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { db, UPLOADS_DIR } from './db';

export interface Medio {
  id: number;
  archivo: string;
  nombre_original: string;
  tipo: 'imagen' | 'video';
  mime: string;
  bytes: number;
  ancho: number | null;
  alto: number | null;
  alt: string;
  creado_en: number;
}

export const MAX_IMAGEN = 15 * 1024 * 1024; // 15 MB
export const MAX_VIDEO = 200 * 1024 * 1024; // 200 MB
const ANCHO_MAX = 1920;

// Nombre de archivo seguro: solo lo que genera el servidor
export const ARCHIVO_VALIDO = /^[a-z0-9]{20}\.(webp|jpg|mp4|webm)$/;

export const urlMedio = (archivo: string) => `/media/${archivo}`;

function tipoVideo(buf: Buffer): 'mp4' | 'webm' | null {
  if (buf.length > 12 && buf.subarray(4, 8).toString('ascii') === 'ftyp') return 'mp4';
  if (buf.length > 4 && buf.readUInt32BE(0) === 0x1a45dfa3) return 'webm';
  return null;
}

export async function guardarArchivo(file: File, alt = ''): Promise<{ ok: true; medio: Medio } | { ok: false; error: string }> {
  const buf = Buffer.from(await file.arrayBuffer());
  const id = randomBytes(10).toString('hex');
  const ahora = Date.now();

  if (file.type.startsWith('image/')) {
    if (buf.length > MAX_IMAGEN) return { ok: false, error: `${file.name}: la imagen supera 15 MB.` };
    try {
      // Se re-codifica a WebP: valida que sea una imagen real, elimina metadatos (GPS) y reduce el peso
      const { data, info } = await sharp(buf, { animated: true })
        .rotate()
        .resize({ width: ANCHO_MAX, withoutEnlargement: true })
        .webp({ quality: 82 })
        .toBuffer({ resolveWithObject: true });
      const archivo = `${id}.webp`;
      await writeFile(path.join(UPLOADS_DIR, archivo), data);
      const r = db
        .prepare(
          'INSERT INTO medios (archivo, nombre_original, tipo, mime, bytes, ancho, alto, alt, creado_en) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        )
        .run(archivo, file.name.slice(0, 200), 'imagen', 'image/webp', data.length, info.width, info.pageHeight ?? info.height, alt, ahora);
      return { ok: true, medio: porId(Number(r.lastInsertRowid))! };
    } catch {
      return { ok: false, error: `${file.name}: no es una imagen válida.` };
    }
  }

  const ext = tipoVideo(buf);
  if (file.type.startsWith('video/') && ext) {
    if (buf.length > MAX_VIDEO) return { ok: false, error: `${file.name}: el video supera 200 MB.` };
    const archivo = `${id}.${ext}`;
    await writeFile(path.join(UPLOADS_DIR, archivo), buf);
    const r = db
      .prepare('INSERT INTO medios (archivo, nombre_original, tipo, mime, bytes, alt, creado_en) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run(archivo, file.name.slice(0, 200), 'video', `video/${ext}`, buf.length, alt, ahora);
    return { ok: true, medio: porId(Number(r.lastInsertRowid))! };
  }

  return { ok: false, error: `${file.name}: formato no permitido. Usa JPG, PNG, WebP, GIF, MP4 o WebM.` };
}

export function porId(id: number) {
  return db.prepare('SELECT * FROM medios WHERE id = ?').get(id) as Medio | undefined;
}

export function listar() {
  return db.prepare('SELECT * FROM medios ORDER BY creado_en DESC').all() as unknown as Medio[];
}

export function actualizarAlt(id: number, alt: string) {
  db.prepare('UPDATE medios SET alt = ? WHERE id = ?').run(alt.slice(0, 200), id);
}

export async function eliminarMedio(id: number) {
  const m = porId(id);
  if (!m) return;
  db.prepare('DELETE FROM medios WHERE id = ?').run(id);
  if (ARCHIVO_VALIDO.test(m.archivo)) await unlink(path.join(UPLOADS_DIR, m.archivo)).catch(() => {});
}

export function tamanoLegible(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
