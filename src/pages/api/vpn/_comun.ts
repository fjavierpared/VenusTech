// Utilidades compartidas por la API de la app VenusTech Shield
import { ErrorApp } from '../../../lib/vpn';

export const tokenDe = (request: Request) => request.headers.get('authorization')?.match(/^Bearer\s+(\S+)$/i)?.[1] ?? null;

export function responder(e: unknown) {
  if (e instanceof ErrorApp) return Response.json({ error: e.message }, { status: e.status });
  console.error('[api/vpn]', e);
  return Response.json({ error: 'El servicio no está disponible en este momento. Inténtalo en unos minutos.' }, { status: 503 });
}

export const sinCache = { 'Cache-Control': 'no-store' };
