// Recibe visitas y eventos de la web pública (enviados con navigator.sendBeacon)
import type { APIRoute } from 'astro';
import { esBot, registrarActividad, registrarEvento, registrarVisita } from '../../lib/analytics';
import { adminDeSesion, COOKIE_SESION, ipDe } from '../../lib/auth';

export const prerender = false;

export const POST: APIRoute = async ({ request, clientAddress, cookies, url }) => {
  const ua = request.headers.get('user-agent') ?? '';
  // No contar bots ni las visitas del propio administrador
  if (esBot(ua) || adminDeSesion(cookies.get(COOKIE_SESION)?.value)) return new Response(null, { status: 204 });

  let datos: Record<string, unknown>;
  try {
    const texto = await request.text();
    if (texto.length > 2000) return new Response(null, { status: 413 });
    datos = JSON.parse(texto);
  } catch {
    return new Response(null, { status: 400 });
  }

  const ip = ipDe(request, clientAddress);
  if (datos.t === 'visita') {
    registrarVisita({
      ruta: datos.ruta,
      referente: datos.ref,
      utm: datos.utm,
      ancho: datos.w,
      v: datos.v,
      pv: datos.pv,
      idioma: datos.idioma,
      pantalla: datos.pantalla,
      ua,
      ip,
      host: url.host,
      headers: request.headers,
    });
  } else if (datos.t === 'ping') {
    registrarActividad({ pv: datos.pv, dur: datos.dur, scroll: datos.scroll });
  } else if (datos.t === 'evento') {
    registrarEvento({ tipo: datos.tipo, detalle: datos.detalle, ruta: datos.ruta, v: datos.v, ua, ip });
  }
  return new Response(null, { status: 204 });
};
