// VPN privada (VenusTech Shield): usuarios, duración del acceso y acceso desde la app.
// Uso interno: sin planes ni cobros. vence_en = null significa acceso sin vencimiento.
import { createHash, randomBytes, randomInt } from 'node:crypto';
import { db } from './db';
import { hashPassword, verificarPassword, bloqueadoPorIntentos, registrarIntentoFallido } from './auth';
import * as wg from './wgeasy';

const DIA = 24 * 60 * 60 * 1000;
export const DIAS_AVISO = 7; // "por vencer" cuando faltan 7 días o menos
export const SERVIDOR_ETIQUETA = 'Europa · Servidor VenusTech';

// Instaladores de VenusTech Shield: privados, se descargan solo desde el panel
// (archivos en DATA_DIR/descargas). Al sacar una versión nueva: copiar los archivos allí
// y cambiar APP_VERSION.
export const APP_VERSION = '0.2.0';
export const APPS = {
  android: { nombre: 'Android', detalle: 'Android 8 o superior', archivo: `VenusTechShield-${APP_VERSION}.apk`, tipo: 'application/vnd.android.package-archive' },
  windows: { nombre: 'Windows', detalle: 'Windows 10 y 11 (64 bits)', archivo: `VenusTechShield-${APP_VERSION}-Windows.exe`, tipo: 'application/vnd.microsoft.portable-executable' },
} as const;
export const urlDescarga = (a: { archivo: string }) => `/admin/vpn/descargas/${a.archivo}`;

// ---------- IPs y acceso al VPS ----------
// Red del VPN: 10.8.0.0/16. Las IPs 10.8.255.1–10.8.255.30 (10.8.255.0/27) son las únicas
// que el firewall del VPN (hooks de wg-easy, cadena VT_GUARD) deja llegar a TODO el VPS
// (SSH, paneles, panel de wg-easy, redes Docker, Tailscale). El resto: solo internet y webs 80/443.
// Están al final a propósito: wg-easy reparte desde la más baja, así que un dispositivo
// creado fuera del CRM nunca recibe acceso al VPS por accidente.
export const VPS_IPS = { prefijo: '10.8.255.', desde: 1, hasta: 30 } as const;
export const VPS_RANGO_TEXTO = `${VPS_IPS.prefijo}${VPS_IPS.desde}–${VPS_IPS.prefijo}${VPS_IPS.hasta}`;

export function esIpVps(ip: string | null | undefined) {
  if (!ip?.startsWith(VPS_IPS.prefijo)) return false;
  const n = Number(ip.slice(VPS_IPS.prefijo.length));
  return Number.isInteger(n) && n >= VPS_IPS.desde && n <= VPS_IPS.hasta;
}

async function ipsUsadas() {
  return new Set((await wg.listarClientes()).map((c) => c.ipv4Address));
}

/** IPs libres del grupo con acceso al VPS (null si el servidor VPN no responde). */
export async function ipsVpsLibres(): Promise<number | null> {
  try {
    const usadas = await ipsUsadas();
    let libres = 0;
    for (let n = VPS_IPS.desde; n <= VPS_IPS.hasta; n++) if (!usadas.has(VPS_IPS.prefijo + n)) libres++;
    return libres;
  } catch {
    return null;
  }
}

function ipLibre(usadas: Set<string>, vps: boolean): string {
  if (vps) {
    for (let n = VPS_IPS.desde; n <= VPS_IPS.hasta; n++) {
      const ip = VPS_IPS.prefijo + n;
      if (!usadas.has(ip)) return ip;
    }
    throw new Error(
      `Ya no quedan IPs con acceso al VPS (${VPS_IPS.hasta - VPS_IPS.desde + 1} dispositivos en total). Quita el acceso a otro cliente o libera un dispositivo.`,
    );
  }
  // 10.8.0.2 – 10.8.254.254 (10.8.0.1 es el servidor y 10.8.255.x queda reservado)
  for (let a = 0; a <= 254; a++) {
    for (let b = a === 0 ? 2 : 1; b <= 254; b++) {
      const ip = `10.8.${a}.${b}`;
      if (!usadas.has(ip)) return ip;
    }
  }
  throw new Error('La red del VPN está llena.');
}

/**
 * Pone el dispositivo en el grupo de IPs que le toca según el permiso del cliente.
 * Si cambia, la app recibe la configuración nueva en su próxima actualización.
 */
async function ubicarDispositivo(d: Pick<Dispositivo, 'id' | 'wg_id'>, vps: boolean, usadas?: Set<string>) {
  const actual = (await wg.obtenerCliente(d.wg_id)).ipv4Address;
  let ip = actual;
  if (esIpVps(actual) !== vps) {
    const u = usadas ?? (await ipsUsadas());
    ip = ipLibre(u, vps);
    await wg.actualizarCliente(d.wg_id, { ipv4Address: ip });
    u.delete(actual);
    u.add(ip);
  }
  db.prepare('UPDATE vpn_dispositivos SET ip = ? WHERE id = ?').run(ip, d.id);
  return ip;
}

/** Da o quita a un usuario el acceso completo al VPS para todos sus dispositivos. */
export async function cambiarAccesoVps(clienteId: number, activar: boolean) {
  const c = cliente(clienteId);
  if (!c) throw new Error('Cliente no encontrado.');
  const lista = dispositivos(clienteId);
  const usadas = await ipsUsadas();
  if (activar) {
    // Comprobar que alcanzan las IPs antes de mover nada
    const porMover = (await Promise.all(lista.map((d) => wg.obtenerCliente(d.wg_id)))).filter((w) => !esIpVps(w.ipv4Address)).length;
    let libres = 0;
    for (let n = VPS_IPS.desde; n <= VPS_IPS.hasta; n++) if (!usadas.has(VPS_IPS.prefijo + n)) libres++;
    if (porMover > libres) throw new Error(`Solo quedan ${libres} IPs con acceso al VPS y este cliente necesita ${porMover}.`);
  }
  db.prepare('UPDATE vpn_clientes SET acceso_vps = ? WHERE id = ?').run(activar ? 1 : 0, clienteId);
  for (const d of lista) await ubicarDispositivo(d, activar, usadas);
}

export interface Cliente {
  id: number;
  nombre: string;
  correo: string;
  whatsapp: string | null;
  notas: string | null;
  hash: string;
  max_dispositivos: number;
  plan: string | null;
  vence_en: number | null;
  suspendido: number;
  /** 1 = sus dispositivos pueden entrar a todo el VPS */
  acceso_vps: number;
  ultimo_acceso: number | null;
  creado_en: number;
}

export interface Dispositivo {
  id: number;
  cliente_id: number;
  device_id: string;
  nombre: string;
  wg_id: number;
  ip: string | null;
  creado_en: number;
  ultimo_acceso: number | null;
}

export type Estado = 'activo' | 'por_vencer' | 'vencido' | 'suspendido';

export const ESTADOS: Record<Estado, { texto: string; clase: string }> = {
  activo: { texto: 'Activo', clase: 'bg-emerald-100 text-emerald-800' },
  por_vencer: { texto: 'Por vencer', clase: 'bg-amber-100 text-amber-800' },
  vencido: { texto: 'Vencido', clase: 'bg-red-100 text-red-700' },
  suspendido: { texto: 'Suspendido', clase: 'bg-slate-200 text-slate-700' },
};

export function estadoDe(c: Pick<Cliente, 'suspendido' | 'vence_en'>, ahora = Date.now()): Estado {
  if (c.suspendido) return 'suspendido';
  if (!c.vence_en) return 'activo'; // sin vencimiento
  if (c.vence_en <= ahora) return 'vencido';
  if (c.vence_en - ahora <= DIAS_AVISO * DIA) return 'por_vencer';
  return 'activo';
}

export const tieneAcceso = (c: Pick<Cliente, 'suspendido' | 'vence_en'>) =>
  !c.suspendido && (c.vence_en === null || c.vence_en > Date.now());

// ---------- Utilidades ----------

/** Contraseña fácil de dictar o copiar: 4 letras/números, guion, 4 más (sin 0/O, 1/l). */
export function generarClave() {
  const abc = 'abcdefghjkmnpqrstuvwxyz23456789';
  const parte = () => Array.from({ length: 4 }, () => abc[randomInt(abc.length)]).join('');
  return `${parte()}-${parte()}`;
}

/** 0414-1234567 → 584141234567 */
export function waNumero(tel: string | null | undefined) {
  if (!tel) return null;
  let d = tel.replace(/\D/g, '');
  if (d.startsWith('0')) d = `58${d.slice(1)}`;
  return d.length >= 10 ? d : null;
}

export const fechaCorta = (ts: number | null) =>
  ts ? new Intl.DateTimeFormat('es-VE', { day: 'numeric', month: 'short', year: 'numeric' }).format(ts) : '—';


const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');
const correoValido = (c: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c);

// ---------- Usuarios ----------

export const cliente = (id: number) => db.prepare('SELECT * FROM vpn_clientes WHERE id = ?').get(id) as unknown as Cliente | undefined;
export const dispositivos = (clienteId: number) =>
  db.prepare('SELECT * FROM vpn_dispositivos WHERE cliente_id = ? ORDER BY creado_en').all(clienteId) as unknown as Dispositivo[];

/** Etiqueta que ve el usuario en la app según la duración del acceso. */
const etiquetaAcceso = (venceEn: number | null) => (venceEn === null ? 'Sin vencimiento' : 'Temporal');

function venceDesdeDias(dias: number | null): number | null {
  if (dias === null) return null;
  const n = Math.round(Number(dias));
  if (!(n >= 1 && n <= 3650)) throw new Error('Indica cuántos días de acceso (1 a 3650) o elige "Sin vencimiento".');
  return Date.now() + n * DIA;
}

export async function crearCliente(datos: {
  nombre: string;
  correo: string;
  whatsapp?: string;
  notas?: string;
  maxDispositivos?: number;
  accesoVps?: boolean;
  /** null = sin vencimiento */
  dias: number | null;
}): Promise<{ id: number; clave: string }> {
  const nombre = datos.nombre.trim();
  const correo = datos.correo.trim().toLowerCase();
  if (!nombre) throw new Error('Escribe el nombre.');
  if (!correoValido(correo)) throw new Error('El correo no es válido.');
  if (db.prepare('SELECT 1 FROM vpn_clientes WHERE correo = ?').get(correo)) throw new Error('Ya existe un usuario con ese correo.');
  const vence = venceDesdeDias(datos.dias); // valida antes de crear nada

  const clave = generarClave();
  const r = db
    .prepare(
      'INSERT INTO vpn_clientes (nombre, correo, whatsapp, notas, hash, max_dispositivos, acceso_vps, plan, vence_en, creado_en) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    )
    .run(
      nombre, correo, datos.whatsapp?.trim() || null, datos.notas?.trim() || null, hashPassword(clave),
      datos.maxDispositivos ?? 2, datos.accesoVps ? 1 : 0, etiquetaAcceso(vence), vence, Date.now(),
    );
  return { id: Number(r.lastInsertRowid), clave };
}

/** Cambia la duración del acceso: null = sin vencimiento, o N días desde hoy. */
export async function fijarAcceso(clienteId: number, dias: number | null) {
  if (!cliente(clienteId)) throw new Error('Usuario no encontrado.');
  const vence = venceDesdeDias(dias);
  db.prepare('UPDATE vpn_clientes SET vence_en = ?, plan = ? WHERE id = ?').run(vence, etiquetaAcceso(vence), clienteId);
  await sincronizar(clienteId);
}

export function editarCliente(id: number, d: { nombre: string; correo: string; whatsapp?: string; notas?: string; maxDispositivos: number }) {
  const correo = d.correo.trim().toLowerCase();
  if (!d.nombre.trim()) throw new Error('Escribe el nombre.');
  if (!correoValido(correo)) throw new Error('El correo no es válido.');
  const otro = db.prepare('SELECT id FROM vpn_clientes WHERE correo = ? AND id != ?').get(correo, id);
  if (otro) throw new Error('Ese correo ya lo usa otro usuario.');
  if (!(d.maxDispositivos >= 1 && d.maxDispositivos <= 10)) throw new Error('Dispositivos: entre 1 y 10.');
  db.prepare('UPDATE vpn_clientes SET nombre = ?, correo = ?, whatsapp = ?, notas = ?, max_dispositivos = ? WHERE id = ?').run(
    d.nombre.trim(), correo, d.whatsapp?.trim() || null, d.notas?.trim() || null, d.maxDispositivos, id,
  );
}

/** Aplica en el servidor VPN el estado del cliente (activo/suspendido y fecha de vencimiento). */
export async function sincronizar(clienteId: number) {
  const c = cliente(clienteId);
  if (!c) return;
  const activo = tieneAcceso(c);
  for (const d of dispositivos(clienteId)) {
    await wg.actualizarCliente(d.wg_id, { enabled: activo, venceEn: c.vence_en });
    await ubicarDispositivo(d, !!c.acceso_vps);
  }
}

export async function suspender(clienteId: number, suspendido: boolean) {
  db.prepare('UPDATE vpn_clientes SET suspendido = ? WHERE id = ?').run(suspendido ? 1 : 0, clienteId);
  await sincronizar(clienteId);
}

export function restablecerClave(clienteId: number) {
  const clave = generarClave();
  db.prepare('UPDATE vpn_clientes SET hash = ? WHERE id = ?').run(hashPassword(clave), clienteId);
  // Cierra las sesiones abiertas en la app: tendrá que entrar con la clave nueva
  db.prepare('DELETE FROM vpn_sesiones WHERE cliente_id = ?').run(clienteId);
  return clave;
}

export async function borrarDispositivo(dispositivoId: number) {
  const d = db.prepare('SELECT * FROM vpn_dispositivos WHERE id = ?').get(dispositivoId) as unknown as Dispositivo | undefined;
  if (!d) return;
  await wg.borrarCliente(d.wg_id);
  db.prepare('DELETE FROM vpn_dispositivos WHERE id = ?').run(dispositivoId);
}

export async function borrarCliente(clienteId: number) {
  for (const d of dispositivos(clienteId)) await wg.borrarCliente(d.wg_id);
  db.prepare('DELETE FROM vpn_clientes WHERE id = ?').run(clienteId);
}

// ---------- Mensajes de WhatsApp ----------

export function mensajeBienvenida(c: Cliente, clave: string) {
  return [
    `Hola ${c.nombre.split(' ')[0]}, ya tienes acceso a VenusTech Shield 🛡️`,
    '',
    '1) Instala la app VenusTech Shield que te envío por aquí (Android o Windows).',
    '2) Entra con estos datos:',
    `Usuario: ${c.correo}`,
    `Contraseña: ${clave}`,
    '',
    c.vence_en ? `Tu acceso vence el ${fechaCorta(c.vence_en)}.` : 'Tu acceso no vence.',
    `Puedes usarlo en ${c.max_dispositivos} dispositivos. No compartas estos datos.`,
  ].join('\n');
}

export function mensajeClaveNueva(c: Cliente, clave: string) {
  return [
    `Hola ${c.nombre.split(' ')[0]}, estos son tus nuevos datos de VenusTech Shield:`,
    `Usuario: ${c.correo}`,
    `Contraseña: ${clave}`,
  ].join('\n');
}

export const enlaceWa = (tel: string | null, texto: string) => {
  const n = waNumero(tel);
  return n ? `https://wa.me/${n}?text=${encodeURIComponent(texto)}` : null;
};

// ---------- Acceso desde la app ----------

export class ErrorApp extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}

const nombreSeguro = (s: string) => s.replace(/[^\w@.\- ()]/g, '').slice(0, 60) || 'dispositivo';

export async function loginApp(d: { correo: string; clave: string; deviceId: string; deviceNombre: string; ip: string }) {
  const llaveIntentos = `vpn:${d.ip}`;
  if (bloqueadoPorIntentos(llaveIntentos)) throw new ErrorApp('Demasiados intentos. Espera 15 minutos e inténtalo de nuevo.', 429);
  const c = db.prepare('SELECT * FROM vpn_clientes WHERE correo = ?').get(d.correo.trim().toLowerCase()) as unknown as Cliente | undefined;
  if (!c || !verificarPassword(d.clave.trim(), c.hash)) {
    registrarIntentoFallido(llaveIntentos);
    throw new ErrorApp('Correo o contraseña incorrectos.', 401);
  }
  db.prepare('DELETE FROM intentos_login WHERE ip = ?').run(llaveIntentos);

  const deviceId = d.deviceId.slice(0, 80);
  if (!/^[\w-]{8,80}$/.test(deviceId)) throw new ErrorApp('Identificador de dispositivo no válido.');
  let disp = db.prepare('SELECT * FROM vpn_dispositivos WHERE cliente_id = ? AND device_id = ?').get(c.id, deviceId) as unknown as
    | Dispositivo
    | undefined;
  if (!disp) {
    const usados = dispositivos(c.id).length;
    if (usados >= c.max_dispositivos) {
      throw new ErrorApp(
        `Ya usas tus ${c.max_dispositivos} dispositivos. Escríbenos por WhatsApp para liberar uno.`,
        403,
      );
    }
    const nombre = nombreSeguro(d.deviceNombre);
    const wgId = await wg.crearCliente(nombreSeguro(`${c.correo} (${nombre})`), c.vence_en);
    if (!tieneAcceso(c)) await wg.actualizarCliente(wgId, { enabled: false });
    const r = db
      .prepare('INSERT INTO vpn_dispositivos (cliente_id, device_id, nombre, wg_id, creado_en) VALUES (?, ?, ?, ?, ?)')
      .run(c.id, deviceId, nombre, wgId, Date.now());
    disp = db.prepare('SELECT * FROM vpn_dispositivos WHERE id = ?').get(Number(r.lastInsertRowid)) as unknown as Dispositivo;
    // La IP se fija antes de entregar la configuración: con o sin acceso al VPS
    try {
      await ubicarDispositivo(disp, !!c.acceso_vps);
    } catch (e) {
      await wg.borrarCliente(wgId);
      db.prepare('DELETE FROM vpn_dispositivos WHERE id = ?').run(disp.id);
      console.error('[vpn] no se pudo asignar IP', e);
      throw new ErrorApp('No pudimos preparar tu acceso. Escríbenos por WhatsApp.', 503);
    }
  }

  const token = randomBytes(32).toString('base64url');
  db.prepare('INSERT INTO vpn_sesiones (token_hash, cliente_id, dispositivo_id, creado_en) VALUES (?, ?, ?, ?)').run(
    sha256(token), c.id, disp.id, Date.now(),
  );
  return { token };
}

function sesionDe(token: string | null) {
  if (!token) return null;
  return db
    .prepare(
      `SELECT c.*, d.id disp_id, d.wg_id, d.nombre disp_nombre FROM vpn_sesiones s
       JOIN vpn_clientes c ON c.id = s.cliente_id
       JOIN vpn_dispositivos d ON d.id = s.dispositivo_id
       WHERE s.token_hash = ?`,
    )
    .get(sha256(token)) as unknown as (Cliente & { disp_id: number; wg_id: number; disp_nombre: string }) | undefined;
}

export async function cuentaApp(token: string | null) {
  const s = sesionDe(token);
  if (!s) throw new ErrorApp('Tu sesión terminó. Vuelve a entrar.', 401);
  const ahora = Date.now();
  db.prepare('UPDATE vpn_clientes SET ultimo_acceso = ? WHERE id = ?').run(ahora, s.id);
  db.prepare('UPDATE vpn_dispositivos SET ultimo_acceso = ? WHERE id = ?').run(ahora, s.disp_id);
  const activo = tieneAcceso(s);
  const estado = estadoDe(s, ahora);
  const { SITE } = await import('../data/site');
  return {
    nombre: s.nombre,
    correo: s.correo,
    plan: s.plan,
    venceEn: s.vence_en,
    estado,
    activo,
    servidor: SERVIDOR_ETIQUETA,
    dispositivo: s.disp_nombre,
    dispositivos: { usados: dispositivos(s.id).length, max: s.max_dispositivos },
    soporteWhatsapp: SITE.whatsapp,
    // Sin plan vigente no se entrega la llave del túnel
    config: activo ? await wg.configuracion(s.wg_id) : null,
  };
}

export function logoutApp(token: string | null) {
  if (token) db.prepare('DELETE FROM vpn_sesiones WHERE token_hash = ?').run(sha256(token));
}
