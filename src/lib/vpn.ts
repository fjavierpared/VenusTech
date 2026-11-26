// CRM VPN: clientes de VenusTech Shield, pagos, vencimientos y acceso desde la app.
import { createHash, randomBytes, randomInt } from 'node:crypto';
import { db } from './db';
import { hashPassword, verificarPassword, bloqueadoPorIntentos, registrarIntentoFallido } from './auth';
import * as wg from './wgeasy';

const DIA = 24 * 60 * 60 * 1000;
export const DIAS_AVISO = 7; // "por vencer" cuando faltan 7 días o menos
export const SERVIDOR_ETIQUETA = 'Europa · Servidor VenusTech';
export const METODOS = ['Binance', 'AirTM', 'Efectivo', 'Transferencia', 'Cortesía'] as const;

export interface Plan {
  id: number;
  nombre: string;
  dias: number;
  precio: number;
  activo: number;
  orden: number;
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
  ultimo_acceso: number | null;
  creado_en: number;
}

export interface Pago {
  id: number;
  cliente_id: number;
  plan: string;
  dias: number;
  monto: number;
  metodo: string;
  referencia: string | null;
  notas: string | null;
  desde: number;
  hasta: number;
  creado_en: number;
}

export interface Dispositivo {
  id: number;
  cliente_id: number;
  device_id: string;
  nombre: string;
  wg_id: number;
  creado_en: number;
  ultimo_acceso: number | null;
}

export type Estado = 'activo' | 'por_vencer' | 'vencido' | 'suspendido' | 'sin_plan';

export const ESTADOS: Record<Estado, { texto: string; clase: string }> = {
  activo: { texto: 'Activo', clase: 'bg-emerald-100 text-emerald-800' },
  por_vencer: { texto: 'Por vencer', clase: 'bg-amber-100 text-amber-800' },
  vencido: { texto: 'Vencido', clase: 'bg-red-100 text-red-700' },
  suspendido: { texto: 'Suspendido', clase: 'bg-slate-200 text-slate-700' },
  sin_plan: { texto: 'Sin plan', clase: 'bg-slate-100 text-slate-600' },
};

export function estadoDe(c: Pick<Cliente, 'suspendido' | 'vence_en'>, ahora = Date.now()): Estado {
  if (c.suspendido) return 'suspendido';
  if (!c.vence_en) return 'sin_plan';
  if (c.vence_en <= ahora) return 'vencido';
  if (c.vence_en - ahora <= DIAS_AVISO * DIA) return 'por_vencer';
  return 'activo';
}

export const tieneAcceso = (c: Pick<Cliente, 'suspendido' | 'vence_en'>) => !c.suspendido && !!c.vence_en && c.vence_en > Date.now();

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

export const dinero = (n: number) => `$${n % 1 === 0 ? n.toFixed(0) : n.toFixed(2)}`;

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');
const correoValido = (c: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c);

// ---------- Planes ----------

export const planes = (soloActivos = true) =>
  db.prepare(`SELECT * FROM vpn_planes ${soloActivos ? 'WHERE activo = 1' : ''} ORDER BY orden, id`).all() as unknown as Plan[];

export function guardarPlan(p: { id?: number; nombre: string; dias: number; precio: number; activo: boolean }) {
  if (!p.nombre.trim() || !(p.dias > 0) || !(p.precio >= 0)) throw new Error('Revisa el nombre, los días y el precio del plan.');
  if (p.id) {
    db.prepare('UPDATE vpn_planes SET nombre = ?, dias = ?, precio = ?, activo = ? WHERE id = ?').run(
      p.nombre.trim(), p.dias, p.precio, p.activo ? 1 : 0, p.id,
    );
  } else {
    const { m } = db.prepare('SELECT COALESCE(MAX(orden), 0) m FROM vpn_planes').get() as { m: number };
    db.prepare('INSERT INTO vpn_planes (nombre, dias, precio, activo, orden) VALUES (?, ?, ?, ?, ?)').run(
      p.nombre.trim(), p.dias, p.precio, p.activo ? 1 : 0, m + 1,
    );
  }
}

// ---------- Clientes ----------

export const cliente = (id: number) => db.prepare('SELECT * FROM vpn_clientes WHERE id = ?').get(id) as unknown as Cliente | undefined;
export const dispositivos = (clienteId: number) =>
  db.prepare('SELECT * FROM vpn_dispositivos WHERE cliente_id = ? ORDER BY creado_en').all(clienteId) as unknown as Dispositivo[];
export const pagosDe = (clienteId: number) =>
  db.prepare('SELECT * FROM vpn_pagos WHERE cliente_id = ? ORDER BY creado_en DESC').all(clienteId) as unknown as Pago[];

export interface DatosPago {
  /** id de plan, o 'cortesia' para acceso gratis */
  plan: number | 'cortesia';
  diasCortesia?: number;
  monto?: number;
  metodo: string;
  referencia?: string;
  notas?: string;
}

function resolverPago(d: DatosPago) {
  if (d.plan === 'cortesia') {
    const dias = Math.round(Number(d.diasCortesia));
    if (!(dias > 0 && dias <= 3650)) throw new Error('Indica cuántos días de cortesía (1 a 3650).');
    return { nombre: 'Cortesía', dias, monto: 0, metodo: 'Cortesía' };
  }
  const p = db.prepare('SELECT * FROM vpn_planes WHERE id = ?').get(d.plan) as unknown as Plan | undefined;
  if (!p) throw new Error('El plan elegido no existe.');
  const monto = d.monto !== undefined && Number.isFinite(d.monto) ? d.monto : p.precio;
  return { nombre: p.nombre, dias: p.dias, monto, metodo: d.metodo || 'Binance' };
}

export async function crearCliente(datos: {
  nombre: string;
  correo: string;
  whatsapp?: string;
  notas?: string;
  maxDispositivos?: number;
  pago: DatosPago;
}): Promise<{ id: number; clave: string }> {
  const nombre = datos.nombre.trim();
  const correo = datos.correo.trim().toLowerCase();
  if (!nombre) throw new Error('Escribe el nombre del cliente.');
  if (!correoValido(correo)) throw new Error('El correo no es válido.');
  if (db.prepare('SELECT 1 FROM vpn_clientes WHERE correo = ?').get(correo)) throw new Error('Ya existe un cliente con ese correo.');
  const pago = resolverPago(datos.pago); // valida antes de crear nada

  const clave = generarClave();
  const ahora = Date.now();
  const r = db
    .prepare(
      'INSERT INTO vpn_clientes (nombre, correo, whatsapp, notas, hash, max_dispositivos, creado_en) VALUES (?, ?, ?, ?, ?, ?, ?)',
    )
    .run(nombre, correo, datos.whatsapp?.trim() || null, datos.notas?.trim() || null, hashPassword(clave), datos.maxDispositivos ?? 2, ahora);
  const id = Number(r.lastInsertRowid);
  await registrarPago(id, datos.pago, pago);
  return { id, clave };
}

export function editarCliente(id: number, d: { nombre: string; correo: string; whatsapp?: string; notas?: string; maxDispositivos: number }) {
  const correo = d.correo.trim().toLowerCase();
  if (!d.nombre.trim()) throw new Error('Escribe el nombre del cliente.');
  if (!correoValido(correo)) throw new Error('El correo no es válido.');
  const otro = db.prepare('SELECT id FROM vpn_clientes WHERE correo = ? AND id != ?').get(correo, id);
  if (otro) throw new Error('Ese correo ya lo usa otro cliente.');
  if (!(d.maxDispositivos >= 1 && d.maxDispositivos <= 10)) throw new Error('Dispositivos: entre 1 y 10.');
  db.prepare('UPDATE vpn_clientes SET nombre = ?, correo = ?, whatsapp = ?, notas = ?, max_dispositivos = ? WHERE id = ?').run(
    d.nombre.trim(), correo, d.whatsapp?.trim() || null, d.notas?.trim() || null, d.maxDispositivos, id,
  );
}

/** Registra un pago (o cortesía) y extiende el vencimiento desde hoy o desde la fecha en que vencía. */
export async function registrarPago(clienteId: number, datos: DatosPago, yaResuelto?: ReturnType<typeof resolverPago>) {
  const c = cliente(clienteId);
  if (!c) throw new Error('Cliente no encontrado.');
  const p = yaResuelto ?? resolverPago(datos);
  const ahora = Date.now();
  const desde = c.vence_en && c.vence_en > ahora ? c.vence_en : ahora;
  const hasta = desde + p.dias * DIA;
  db.exec('BEGIN');
  try {
    db.prepare(
      'INSERT INTO vpn_pagos (cliente_id, plan, dias, monto, metodo, referencia, notas, desde, hasta, creado_en) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    ).run(clienteId, p.nombre, p.dias, p.monto, p.metodo, datos.referencia?.trim() || null, datos.notas?.trim() || null, desde, hasta, ahora);
    db.prepare('UPDATE vpn_clientes SET vence_en = ?, plan = ? WHERE id = ?').run(hasta, p.nombre, clienteId);
    db.exec('COMMIT');
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
  await sincronizar(clienteId);
}

/** Anula un pago registrado por error y recalcula el vencimiento. */
export async function anularPago(pagoId: number) {
  const p = db.prepare('SELECT * FROM vpn_pagos WHERE id = ?').get(pagoId) as unknown as Pago | undefined;
  if (!p) return;
  db.prepare('DELETE FROM vpn_pagos WHERE id = ?').run(pagoId);
  const c = cliente(p.cliente_id)!;
  // El vencimiento se reduce en los días de ese pago (sin bajar de la fecha del pago anterior)
  const nuevo = c.vence_en ? c.vence_en - p.dias * DIA : null;
  const ultimo = db.prepare('SELECT plan FROM vpn_pagos WHERE cliente_id = ? ORDER BY creado_en DESC LIMIT 1').get(p.cliente_id) as
    | { plan: string }
    | undefined;
  db.prepare('UPDATE vpn_clientes SET vence_en = ?, plan = ? WHERE id = ?').run(ultimo ? nuevo : null, ultimo?.plan ?? null, p.cliente_id);
  await sincronizar(p.cliente_id);
}

/** Aplica en el servidor VPN el estado del cliente (activo/suspendido y fecha de vencimiento). */
export async function sincronizar(clienteId: number) {
  const c = cliente(clienteId);
  if (!c) return;
  const activo = tieneAcceso(c);
  for (const d of dispositivos(clienteId)) {
    await wg.actualizarCliente(d.wg_id, { enabled: activo, venceEn: c.vence_en });
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
    `Hola ${c.nombre.split(' ')[0]}, ¡bienvenido a VenusTech Shield! 🛡️`,
    '',
    '1) Descarga la app: https://vpn.venustechfp.com/#app',
    '2) Entra con estos datos:',
    `Usuario: ${c.correo}`,
    `Contraseña: ${clave}`,
    '',
    `Tu plan ${c.plan ?? ''} vence el ${fechaCorta(c.vence_en)}. Puedes usarlo en ${c.max_dispositivos} dispositivos.`,
    'Cualquier duda, escríbeme por aquí.',
  ].join('\n');
}

export function mensajeClaveNueva(c: Cliente, clave: string) {
  return [
    `Hola ${c.nombre.split(' ')[0]}, estos son tus nuevos datos de VenusTech Shield:`,
    `Usuario: ${c.correo}`,
    `Contraseña: ${clave}`,
  ].join('\n');
}

export function mensajeRecordatorio(c: Cliente) {
  const vencido = !!c.vence_en && c.vence_en <= Date.now();
  const precios = planes()
    .map((p) => `${p.nombre} ${dinero(p.precio)}`)
    .join(' · ');
  return [
    `Hola ${c.nombre.split(' ')[0]}, ${vencido ? 'tu VPN VenusTech Shield venció' : 'tu VPN VenusTech Shield vence'} el ${fechaCorta(c.vence_en)}.`,
    `Para renovar: ${precios}. Aceptamos Binance y AirTM.`,
    'Envíame el comprobante por aquí y te activo al momento.',
  ].join('\n');
}

export function mensajePagoRecibido(c: Cliente) {
  return `Hola ${c.nombre.split(' ')[0]}, recibí tu pago. ✅ Tu VenusTech Shield queda activo hasta el ${fechaCorta(c.vence_en)}. ¡Gracias!`;
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

// ---------- Resumen para el panel ----------

export function resumen() {
  const ahora = Date.now();
  const todos = db.prepare('SELECT * FROM vpn_clientes').all() as unknown as Cliente[];
  const conteo: Record<Estado, number> = { activo: 0, por_vencer: 0, vencido: 0, suspendido: 0, sin_plan: 0 };
  for (const c of todos) conteo[estadoDe(c, ahora)]++;
  const inicioMes = new Date(new Date(ahora).getFullYear(), new Date(ahora).getMonth(), 1).getTime();
  const { mes } = db.prepare('SELECT COALESCE(SUM(monto), 0) mes FROM vpn_pagos WHERE creado_en >= ?').get(inicioMes) as { mes: number };
  const porVencer = db
    .prepare('SELECT * FROM vpn_clientes WHERE suspendido = 0 AND vence_en IS NOT NULL AND vence_en <= ? ORDER BY vence_en')
    .all(ahora + DIAS_AVISO * DIA) as unknown as Cliente[];
  return { total: todos.length, conteo, ingresosMes: mes, porVencer };
}
