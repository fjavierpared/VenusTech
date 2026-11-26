// Cliente de la API de wg-easy (servidor VenustechVPN).
// La web llega al panel por la red interna de Docker; el panel NUNCA se publica a internet.
// Dirección: WG_API_URL (ej. http://venustechvpn:51821).
// Usuario y contraseña: se guardan desde el CRM (/admin/vpn/conexion), cifrados en la tabla
// ajustes; si no hay, se usan WG_API_USER y WG_API_PASSWORD(_ENC) del .env.
import { env, cifrar, descifrar } from './secretos';
import { db } from './db';

const AJ_USUARIO = 'wg_api_user';
const AJ_CLAVE = 'wg_api_password';

const ajuste = (clave: string) =>
  (db.prepare('SELECT valor FROM ajustes WHERE clave = ?').get(clave) as { valor: string } | undefined)?.valor;
const guardarAjuste = (clave: string, valor: string) =>
  db.prepare('INSERT INTO ajustes (clave, valor) VALUES (?, ?) ON CONFLICT(clave) DO UPDATE SET valor = excluded.valor').run(clave, valor);

function credenciales(): { usuario?: string; clave?: string; origen: 'panel' | 'env' | null } {
  const cifrada = ajuste(AJ_CLAVE);
  if (cifrada) return { usuario: ajuste(AJ_USUARIO) || 'admin', clave: descifrar(cifrada), origen: 'panel' };
  const clave = env('WG_API_PASSWORD');
  return { usuario: env('WG_API_USER') || 'admin', clave, origen: clave ? 'env' : null };
}

/** Si hay una contraseña de wg-easy configurada (sin probarla). */
export const conexionConfigurada = () => !!credenciales().clave;

export interface WgCliente {
  id: number;
  name: string;
  enabled: boolean;
  expiresAt: string | null;
  ipv4Address: string;
  [k: string]: unknown;
}

// Campos que el servidor genera y no acepta de vuelta al actualizar
const SOLO_LECTURA = ['id', 'userId', 'interfaceId', 'publicKey', 'createdAt', 'updatedAt', 'endpoint', 'oneTimeLink'];

const urlApi = () => (env('WG_API_URL') || 'http://venustechvpn:51821').replace(/\/$/, '');
const basic = (usuario: string, clave: string) => `Basic ${Buffer.from(`${usuario}:${clave}`).toString('base64')}`;

function base() {
  const { usuario, clave } = credenciales();
  if (!usuario || !clave) {
    throw new Error('Falta conectar la web con el servidor VPN: entra a CRM VPN → Conexión y guarda la contraseña de wg-easy.');
  }
  return { url: urlApi(), auth: basic(usuario, clave) };
}

/** Prueba un usuario/contraseña de wg-easy (o los guardados) sin modificar nada. */
export async function probarConexion(usuario?: string, clave?: string): Promise<{ ok: boolean; mensaje: string; dispositivos?: number }> {
  const c = credenciales();
  const u = usuario ?? c.usuario;
  const k = clave ?? c.clave;
  if (!u || !k) return { ok: false, mensaje: 'Aún no hay una contraseña de wg-easy guardada.' };
  try {
    const res = await fetch(`${urlApi()}/api/client`, { headers: { Authorization: basic(u, k) }, signal: AbortSignal.timeout(8_000) });
    if (res.status === 401 || res.status === 403) return { ok: false, mensaje: 'wg-easy rechazó el usuario o la contraseña.' };
    if (!res.ok) return { ok: false, mensaje: `El servidor VPN respondió con un error (${res.status}).` };
    const lista = (await res.json()) as unknown[];
    return { ok: true, mensaje: 'Conectado con el servidor VPN.', dispositivos: lista.length };
  } catch {
    return { ok: false, mensaje: 'No se pudo llegar al servidor VPN. ¿Está encendido el contenedor venustechvpn?' };
  }
}

/** Guarda (cifrados) el usuario y la contraseña de wg-easy, solo si funcionan. */
export async function guardarConexion(usuario: string, clave: string) {
  usuario = usuario.trim() || 'admin';
  if (!clave) throw new Error('Escribe la contraseña del panel de wg-easy.');
  const prueba = await probarConexion(usuario, clave);
  if (!prueba.ok) throw new Error(`${prueba.mensaje} No se guardó nada.`);
  const cifrada = cifrar(clave);
  if (!cifrada) throw new Error('No se encontró la llave de cifrado de la web: no se puede guardar la contraseña de forma segura.');
  guardarAjuste(AJ_USUARIO, usuario);
  guardarAjuste(AJ_CLAVE, cifrada);
  return prueba;
}

export const origenConexion = () => credenciales().origen;
export const usuarioConexion = () => credenciales().usuario ?? 'admin';

async function llamar(metodo: string, ruta: string, cuerpo?: unknown): Promise<Response> {
  const { url, auth } = base();
  const res = await fetch(`${url}/api${ruta}`, {
    method: metodo,
    headers: { Authorization: auth, ...(cuerpo !== undefined ? { 'Content-Type': 'application/json' } : {}) },
    body: cuerpo !== undefined ? JSON.stringify(cuerpo) : undefined,
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) {
    const detalle = await res.text().catch(() => '');
    throw new Error(`Servidor VPN respondió ${res.status} en ${metodo} ${ruta}: ${detalle.slice(0, 200)}`);
  }
  return res;
}

const iso = (ts: number | null) => (ts ? new Date(ts).toISOString() : null);

export async function crearCliente(nombre: string, venceEn: number | null): Promise<number> {
  const r = (await (await llamar('POST', '/client', { name: nombre, expiresAt: iso(venceEn) })).json()) as { clientId: number };
  return r.clientId;
}

export async function obtenerCliente(id: number): Promise<WgCliente> {
  return (await (await llamar('GET', `/client/${id}`)).json()) as WgCliente;
}

/** Cambia activo/vencimiento/nombre/IP conservando el resto de la configuración del cliente. */
export async function actualizarCliente(
  id: number,
  cambios: { enabled?: boolean; venceEn?: number | null; nombre?: string; ipv4Address?: string },
) {
  const actual = await obtenerCliente(id);
  const datos: Record<string, unknown> = { ...actual };
  for (const k of SOLO_LECTURA) delete datos[k];
  if (cambios.enabled !== undefined) datos.enabled = cambios.enabled;
  if (cambios.venceEn !== undefined) datos.expiresAt = iso(cambios.venceEn);
  if (cambios.nombre !== undefined) datos.name = cambios.nombre;
  if (cambios.ipv4Address !== undefined) datos.ipv4Address = cambios.ipv4Address;
  await llamar('POST', `/client/${id}`, datos);
}

export async function borrarCliente(id: number) {
  try {
    await llamar('DELETE', `/client/${id}`);
  } catch (e) {
    // Si ya no existe en el servidor, no es un error para nosotros
    if (!String(e).includes(' 404 ')) throw e;
  }
}

export async function configuracion(id: number): Promise<string> {
  return (await llamar('GET', `/client/${id}/configuration`)).text();
}

/** Estado de conexión de todos los clientes (último saludo del túnel). */
export async function listarClientes(): Promise<(WgCliente & { latestHandshakeAt?: string | null })[]> {
  return (await (await llamar('GET', '/client')).json()) as (WgCliente & { latestHandshakeAt?: string | null })[];
}
