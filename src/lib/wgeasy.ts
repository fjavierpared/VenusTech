// Cliente de la API de wg-easy (servidor VenustechVPN).
// La web llega al panel por la red interna de Docker; el panel NUNCA se publica a internet.
// Variables: WG_API_URL (ej. http://venustechvpn:51821), WG_API_USER, WG_API_PASSWORD (o WG_API_PASSWORD_ENC).
import { env } from './secretos';

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

function base() {
  const url = env('WG_API_URL');
  const usuario = env('WG_API_USER');
  const clave = env('WG_API_PASSWORD');
  if (!url || !usuario || !clave) throw new Error('Falta configurar WG_API_URL, WG_API_USER y WG_API_PASSWORD.');
  return { url: url.replace(/\/$/, ''), auth: `Basic ${Buffer.from(`${usuario}:${clave}`).toString('base64')}` };
}

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
