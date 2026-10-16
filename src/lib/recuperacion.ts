// Recuperación de contraseña por enlace de un solo uso enviado al correo del administrador.
import { createHash, randomBytes } from 'node:crypto';
import { db } from './db';
import { hashPassword } from './auth';

const VIGENCIA = 30 * 60 * 1000; // 30 minutos
const MAX_POR_HORA = 3;

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');

/** Devuelve el token (para armar el enlace) o null si no corresponde enviar nada */
export function crearSolicitud(usuario: string): string | null {
  const ahora = Date.now();
  db.prepare('DELETE FROM recuperaciones WHERE expira_en < ?').run(ahora - 24 * 3_600_000);
  // Límite global: evita que alguien llene tu correo de solicitudes
  const { n } = db.prepare('SELECT COUNT(*) n FROM recuperaciones WHERE creado_en > ?').get(ahora - 3_600_000) as { n: number };
  if (n >= MAX_POR_HORA) return null;

  const admin = db.prepare('SELECT id FROM admins WHERE usuario = ?').get(usuario) as { id: number } | undefined;
  if (!admin) return null;

  // Solo el último enlace sirve
  db.prepare('UPDATE recuperaciones SET usado = 1 WHERE admin_id = ?').run(admin.id);
  const token = randomBytes(32).toString('base64url');
  db.prepare('INSERT INTO recuperaciones (token_hash, admin_id, expira_en, creado_en) VALUES (?, ?, ?, ?)').run(
    sha256(token),
    admin.id,
    ahora + VIGENCIA,
    ahora,
  );
  return token;
}

export function tokenValido(token: string) {
  const fila = db
    .prepare('SELECT admin_id FROM recuperaciones WHERE token_hash = ? AND usado = 0 AND expira_en > ?')
    .get(sha256(token), Date.now()) as { admin_id: number } | undefined;
  return fila?.admin_id ?? null;
}

export function restablecer(token: string, nueva: string): { ok: true } | { ok: false; error: string } {
  if (nueva.length < 12) return { ok: false, error: 'La contraseña debe tener al menos 12 caracteres.' };
  const adminId = tokenValido(token);
  if (!adminId) return { ok: false, error: 'El enlace expiró o ya se usó. Solicita uno nuevo.' };
  db.exec('BEGIN');
  try {
    db.prepare('UPDATE admins SET hash = ? WHERE id = ?').run(hashPassword(nueva), adminId);
    db.prepare('UPDATE recuperaciones SET usado = 1 WHERE admin_id = ?').run(adminId);
    // Cierra todas las sesiones abiertas: si alguien tenía acceso, lo pierde
    db.prepare('DELETE FROM sesiones WHERE admin_id = ?').run(adminId);
    db.exec('COMMIT');
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
  return { ok: true };
}
