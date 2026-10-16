import { randomBytes, scryptSync, timingSafeEqual, createHash } from 'node:crypto';
import type { AstroCookies } from 'astro';
import { db } from './db';

export const COOKIE_SESION = 'vt_sesion';
const DURACION_SESION = 7 * 24 * 60 * 60 * 1000; // 7 días
const MAX_INTENTOS = 5;
const VENTANA_INTENTOS = 15 * 60 * 1000; // 15 minutos

export function hashPassword(password: string) {
  const sal = randomBytes(16);
  const hash = scryptSync(password, sal, 64, { N: 16384, r: 8, p: 1 });
  return `scrypt$${sal.toString('hex')}$${hash.toString('hex')}`;
}

export function verificarPassword(password: string, guardado: string) {
  const [alg, salHex, hashHex] = guardado.split('$');
  if (alg !== 'scrypt' || !salHex || !hashHex) return false;
  const esperado = Buffer.from(hashHex, 'hex');
  const calculado = scryptSync(password, Buffer.from(salHex, 'hex'), esperado.length, { N: 16384, r: 8, p: 1 });
  return timingSafeEqual(esperado, calculado);
}

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');

export function bloqueadoPorIntentos(ip: string) {
  const desde = Date.now() - VENTANA_INTENTOS;
  db.prepare('DELETE FROM intentos_login WHERE ts < ?').run(desde);
  const { n } = db.prepare('SELECT COUNT(*) n FROM intentos_login WHERE ip = ? AND ts >= ?').get(ip, desde) as { n: number };
  return n >= MAX_INTENTOS;
}

export function registrarIntentoFallido(ip: string) {
  db.prepare('INSERT INTO intentos_login (ip, ts) VALUES (?, ?)').run(ip, Date.now());
}

export function iniciarSesion(usuario: string, password: string, ip: string): string | null {
  const admin = db.prepare('SELECT id, hash FROM admins WHERE usuario = ?').get(usuario) as
    | { id: number; hash: string }
    | undefined;
  // Se verifica igual aunque el usuario no exista, para no revelar cuáles existen
  const ok = verificarPassword(password, admin?.hash ?? hashFicticio);
  if (!admin || !ok) {
    registrarIntentoFallido(ip);
    return null;
  }
  db.prepare('DELETE FROM intentos_login WHERE ip = ?').run(ip);
  const token = randomBytes(32).toString('base64url');
  const ahora = Date.now();
  db.prepare('INSERT INTO sesiones (token_hash, admin_id, expira_en, creado_en) VALUES (?, ?, ?, ?)').run(
    sha256(token),
    admin.id,
    ahora + DURACION_SESION,
    ahora,
  );
  return token;
}
const hashFicticio = hashPassword(randomBytes(16).toString('hex'));

export function adminDeSesion(token: string | undefined) {
  if (!token) return null;
  const fila = db
    .prepare(
      'SELECT a.id, a.usuario FROM sesiones s JOIN admins a ON a.id = s.admin_id WHERE s.token_hash = ? AND s.expira_en > ?',
    )
    .get(sha256(token), Date.now()) as { id: number; usuario: string } | undefined;
  return fila ?? null;
}

export function cerrarSesion(token: string | undefined) {
  if (token) db.prepare('DELETE FROM sesiones WHERE token_hash = ?').run(sha256(token));
  db.prepare('DELETE FROM sesiones WHERE expira_en < ?').run(Date.now());
}

export function guardarCookieSesion(cookies: AstroCookies, token: string) {
  cookies.set(COOKIE_SESION, token, {
    httpOnly: true,
    secure: import.meta.env.PROD,
    sameSite: 'strict',
    path: '/',
    maxAge: DURACION_SESION / 1000,
  });
}

export function ipDe(request: Request, clientAddress: string | undefined) {
  // Detrás de Nginx (TRUST_PROXY=1), la IP real llega en X-Real-IP. Sin proxy no se confía en ese header.
  const delProxy = process.env.TRUST_PROXY === '1' ? request.headers.get('x-real-ip') : null;
  return delProxy ?? clientAddress ?? 'desconocida';
}
