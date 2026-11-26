import type { APIRoute } from 'astro';
import { ipDe } from '../../../lib/auth';
import { loginApp, ErrorApp } from '../../../lib/vpn';
import { responder, sinCache } from './_comun';

export const prerender = false;

// POST { correo, clave, deviceId, deviceNombre } → { token }
export const POST: APIRoute = async ({ request, clientAddress }) => {
  try {
    const b = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    if (!b || typeof b.correo !== 'string' || typeof b.clave !== 'string' || typeof b.deviceId !== 'string') {
      throw new ErrorApp('Escribe tu correo y tu contraseña.');
    }
    const r = await loginApp({
      correo: b.correo,
      clave: b.clave,
      deviceId: b.deviceId,
      deviceNombre: typeof b.deviceNombre === 'string' ? b.deviceNombre : 'Teléfono',
      ip: ipDe(request, clientAddress),
    });
    return Response.json(r, { headers: sinCache });
  } catch (e) {
    return responder(e);
  }
};
