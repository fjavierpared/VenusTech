// Publicación automática en Instagram con la API oficial de Meta ("Instagram API con inicio de sesión de Instagram").
// Requisitos: cuenta profesional (empresa o creador) y un token de acceso de una app de Meta
// con los permisos instagram_business_basic e instagram_business_content_publish (ver /admin/instagram).
import { randomBytes } from 'node:crypto';
import { readFile, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { SITE } from '../data/site';
import { db, UPLOADS_DIR } from './db';
import { ARCHIVO_VALIDO } from './medios';
import { porId, type Publicacion } from './publicaciones';
import { cifrar, descifrar } from './secretos';

const API = 'https://graph.instagram.com';
const VERSION = 'v24.0';
const DIA = 24 * 60 * 60 * 1000;

export const PLANTILLA_POR_DEFECTO = `{titulo}

{resumen}

📖 Lee el artículo completo en el enlace de mi perfil o en {url}

#VenusTech #Mérida #Tecnología`;

// ── Ajustes (tabla ajustes, claves ig_*) ─────────────────────
function leer(clave: string) {
  return (db.prepare('SELECT valor FROM ajustes WHERE clave = ?').get(`ig_${clave}`) as { valor: string } | undefined)?.valor;
}
function escribir(clave: string, valor: string | null) {
  if (valor === null) db.prepare('DELETE FROM ajustes WHERE clave = ?').run(`ig_${clave}`);
  else
    db.prepare('INSERT INTO ajustes (clave, valor) VALUES (?, ?) ON CONFLICT(clave) DO UPDATE SET valor = excluded.valor').run(
      `ig_${clave}`,
      valor,
    );
}

export interface ConfigInstagram {
  conectado: boolean;
  usuario: string | null;
  expira: number | null;
  auto: boolean;
  plantilla: string;
  aviso: string | null;
}

export function config(): ConfigInstagram {
  return {
    conectado: Boolean(leer('token')),
    usuario: leer('usuario') ?? null,
    expira: Number(leer('expira')) || null,
    auto: leer('auto') !== '0',
    plantilla: leer('plantilla') ?? PLANTILLA_POR_DEFECTO,
    aviso: leer('aviso') ?? null,
  };
}

export function guardarPreferencias(auto: boolean, plantilla: string) {
  escribir('auto', auto ? '1' : '0');
  escribir('plantilla', plantilla.trim().slice(0, 2200) || PLANTILLA_POR_DEFECTO);
}

function token() {
  const t = leer('token');
  return t ? descifrar(t) : undefined;
}

// ── Llamadas a la API ────────────────────────────────────────
class ErrorInstagram extends Error {
  constructor(
    mensaje: string,
    public codigo?: number,
  ) {
    super(mensaje);
  }
}

async function api<T>(ruta: string, opciones: { metodo?: 'GET' | 'POST'; params?: Record<string, string>; tk?: string } = {}) {
  const tk = opciones.tk ?? token();
  if (!tk) throw new ErrorInstagram('Instagram no está conectado.');
  const params = new URLSearchParams({ ...opciones.params, access_token: tk });
  const metodo = opciones.metodo ?? 'GET';
  const url = ruta.startsWith('/refresh') ? `${API}${ruta}` : `${API}/${VERSION}${ruta}`;
  const res = await fetch(metodo === 'GET' ? `${url}?${params}` : url, {
    method: metodo,
    body: metodo === 'POST' ? params : undefined,
    signal: AbortSignal.timeout(30_000),
  });
  const datos = (await res.json().catch(() => ({}))) as T & { error?: { message?: string; error_user_msg?: string; code?: number } };
  if (!res.ok || datos.error) {
    const e = datos.error;
    if (e?.code === 190) throw new ErrorInstagram('El token de Instagram venció o fue revocado. Conéctalo de nuevo en el panel.', 190);
    throw new ErrorInstagram(e?.error_user_msg || e?.message || `Instagram respondió con el error ${res.status}.`, e?.code);
  }
  return datos as T;
}

/** Valida el token, guarda la cuenta y lo cambia por uno de larga duración si hace falta */
export async function conectar(tokenNuevo: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const tk = tokenNuevo.trim();
  if (!/^[A-Za-z0-9_|-]{40,}$/.test(tk)) return { ok: false, error: 'Ese texto no parece un token de acceso de Instagram.' };
  try {
    const yo = await api<{ user_id: string; username: string }>('/me', { params: { fields: 'user_id,username' }, tk });
    const cifrado = cifrar(tk);
    if (!cifrado) return { ok: false, error: 'No encontré la llave de cifrado del servidor para guardar el token con seguridad.' };
    escribir('token', cifrado);
    escribir('user_id', yo.user_id);
    escribir('usuario', yo.username);
    // Los tokens generados en el panel de Meta duran 60 días; se renuevan solos (ver renovarToken)
    escribir('expira', String(Date.now() + 60 * DIA));
    escribir('renovado', String(Date.now()));
    escribir('aviso', null);
    return { ok: true };
  } catch (e) {
    if (e instanceof ErrorInstagram && e.codigo === 190)
      return { ok: false, error: 'Meta rechazó ese token. Genera uno nuevo y cópialo completo.' };
    return { ok: false, error: e instanceof Error ? e.message : 'No se pudo validar el token.' };
  }
}

export function desconectar() {
  for (const c of ['token', 'user_id', 'usuario', 'expira', 'renovado', 'aviso']) escribir(c, null);
}

/** Pide a Meta un token nuevo (válido otros 60 días). Solo funciona con tokens de más de 24 h. */
export async function renovarToken(forzar = false) {
  const tk = token();
  if (!tk) return;
  const renovado = Number(leer('renovado')) || 0;
  if (!forzar && Date.now() - renovado < 7 * DIA) return;
  try {
    const r = await api<{ access_token: string; expires_in: number }>('/refresh_access_token', {
      params: { grant_type: 'ig_refresh_token' },
      tk,
    });
    escribir('token', cifrar(r.access_token) ?? leer('token')!);
    escribir('expira', String(Date.now() + r.expires_in * 1000));
    escribir('renovado', String(Date.now()));
    escribir('aviso', null);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('Instagram: no se pudo renovar el token:', msg);
    if (e instanceof ErrorInstagram && e.codigo === 190) escribir('aviso', msg);
  }
}

/** Renueva el token en segundo plano cada 12 h mientras el servidor esté encendido */
export function programarRenovacion() {
  const g = globalThis as unknown as { __vtIgTimer?: NodeJS.Timeout };
  if (g.__vtIgTimer) return;
  const tarea = () => void renovarToken().catch(() => {});
  g.__vtIgTimer = setInterval(tarea, DIA / 2);
  g.__vtIgTimer.unref();
  setTimeout(tarea, 60_000).unref();
}

// ── Publicar ─────────────────────────────────────────────────
export function textoPara(p: Pick<Publicacion, 'titulo' | 'resumen' | 'slug' | 'ig_texto'>, plantilla = config().plantilla) {
  const base = p.ig_texto.trim() || plantilla;
  return base
    .replaceAll('{titulo}', p.titulo)
    .replaceAll('{resumen}', p.resumen)
    .replaceAll('{url}', `${SITE.url}/blog/${p.slug}`)
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, 2200);
}

/**
 * Instagram solo acepta JPEG con proporción entre 4:5 (vertical) y 1.91:1 (horizontal).
 * Se crea una copia temporal en /media/ que Meta descarga desde la web pública.
 */
async function prepararImagen(portada: string) {
  const original = portada.split('/').pop() ?? '';
  if (!portada.startsWith('/media/') || !ARCHIVO_VALIDO.test(original)) throw new ErrorInstagram('La portada no es una imagen de la biblioteca.');
  const buf = await readFile(path.join(UPLOADS_DIR, original));
  const { width = 1080, height = 1080 } = await sharp(buf).metadata();
  const proporcion = Math.min(1.91, Math.max(0.8, width / height));
  const ancho = 1080;
  const jpg = await sharp(buf)
    .resize({ width: ancho, height: Math.round(ancho / proporcion), fit: 'cover', position: 'attention' })
    .flatten({ background: '#ffffff' })
    .jpeg({ quality: 90, mozjpeg: true })
    .toBuffer();
  const archivo = `${randomBytes(10).toString('hex')}.jpg`;
  await writeFile(path.join(UPLOADS_DIR, archivo), jpg);
  return archivo;
}

export const VIDEO_VALIDO = /^\/media\/[a-z0-9]{20}\.mp4$/;

// Las fotos se procesan en segundos; los videos (Reels) pueden tardar varios minutos
async function esperarContenedor(id: string, esVideo: boolean) {
  const limite = Date.now() + (esVideo ? 15 : 1) * 60_000;
  while (Date.now() < limite) {
    const { status_code } = await api<{ status_code: string }>(`/${id}`, { params: { fields: 'status_code' } });
    if (status_code === 'FINISHED') return;
    if (status_code === 'ERROR' || status_code === 'EXPIRED')
      throw new ErrorInstagram(
        esVideo
          ? 'Instagram no pudo procesar el video. Debe ser MP4 (H.264 con audio AAC), de 3 s a 15 min y menos de 300 MB.'
          : 'Instagram no pudo procesar la imagen.',
      );
    await new Promise((r) => setTimeout(r, esVideo ? 5000 : 2000));
  }
  throw new ErrorInstagram(`Instagram tardó demasiado en procesar ${esVideo ? 'el video' : 'la imagen'}. Inténtalo de nuevo.`);
}

/**
 * Empieza a compartir la entrada en Instagram: una foto con la portada o, si eligió uno, un Reel con el video.
 * Responde al momento y el trabajo sigue en segundo plano (ig_estado = 'publicando' → 'ok' | 'error').
 */
export function compartir(id: number): { ok: true } | { ok: false; error: string } {
  const fallo = (error: string) => {
    db.prepare("UPDATE publicaciones SET ig_estado = 'error', ig_error = ? WHERE id = ?").run(error, id);
    return { ok: false as const, error };
  };

  const p = porId(id);
  if (!p) return { ok: false, error: 'La publicación no existe.' };
  if (p.estado !== 'publicado') return { ok: false, error: 'Primero publica la entrada en la web.' };
  if (p.ig_estado === 'ok') return { ok: true };
  if (!config().conectado) return fallo('Instagram no está conectado.');
  const video = p.ig_video && VIDEO_VALIDO.test(p.ig_video) ? p.ig_video : null;
  if (!video && !p.portada) return fallo('Instagram necesita una imagen o un video: elige una portada o un video para Instagram.');
  if (!/^https:\/\//.test(SITE.url) || /localhost|127\.0\.0\.1/.test(SITE.url))
    return fallo('Instagram descarga el archivo desde tu web pública: esto solo funciona en el servidor con tu dominio (SITE_URL).');

  // Evita publicar dos veces si se pulsa el botón repetidamente (un intento colgado se libera a los 20 min)
  const tomada = db
    .prepare(
      `UPDATE publicaciones SET ig_estado = 'publicando', ig_error = NULL, ig_publicado_en = ?
       WHERE id = ? AND ig_estado != 'ok' AND NOT (ig_estado = 'publicando' AND ig_publicado_en > ?)`,
    )
    .run(Date.now(), id, Date.now() - 20 * 60_000);
  if (!tomada.changes) return { ok: false, error: 'Ya se está compartiendo en Instagram.' };

  void publicar(p, video).catch((e) => {
    if (e instanceof ErrorInstagram && e.codigo === 190) escribir('aviso', e.message);
    console.error('Instagram: no se pudo publicar:', e);
    fallo(e instanceof Error ? e.message : 'Error desconocido al publicar en Instagram.');
  });
  return { ok: true };
}

async function publicar(p: Publicacion, video: string | null) {
  let archivo: string | undefined;
  try {
    await renovarToken();
    const usuario = leer('user_id') ?? 'me';
    let params: Record<string, string>;
    if (video) {
      params = { media_type: 'REELS', video_url: `${SITE.url}${video}`, share_to_feed: 'true' };
    } else {
      archivo = await prepararImagen(p.portada!);
      params = { image_url: `${SITE.url}/media/${archivo}` };
    }
    const contenedor = await api<{ id: string }>(`/${usuario}/media`, { metodo: 'POST', params: { ...params, caption: textoPara(p) } });
    await esperarContenedor(contenedor.id, Boolean(video));
    const post = await api<{ id: string }>(`/${usuario}/media_publish`, { metodo: 'POST', params: { creation_id: contenedor.id } });
    const { permalink = '' } = await api<{ permalink?: string }>(`/${post.id}`, { params: { fields: 'permalink' } }).catch(() => ({
      permalink: '',
    }));
    db.prepare("UPDATE publicaciones SET ig_estado = 'ok', ig_error = NULL, ig_permalink = ?, ig_publicado_en = ? WHERE id = ?").run(
      permalink || `https://www.instagram.com/${leer('usuario') ?? ''}/`,
      Date.now(),
      p.id,
    );
  } finally {
    if (archivo) await unlink(path.join(UPLOADS_DIR, archivo)).catch(() => {});
  }
}

/** Estado para que el editor muestre el progreso */
export function estado(id: number) {
  const p = porId(id);
  return p ? { estado: p.ig_estado, error: p.ig_error, permalink: p.ig_permalink } : null;
}
