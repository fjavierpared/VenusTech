// Guarda las consultas del formulario para verlas en el panel
import type { APIRoute } from 'astro';
import { db } from '../../lib/db';
import { ipDe } from '../../lib/auth';
import { enviarCorreo } from '../../lib/correo';

export const prerender = false;

const LIMITE_POR_HORA = 5;
const envios = new Map<string, number[]>();

const texto = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

export const POST: APIRoute = async ({ request, clientAddress }) => {
  let datos: Record<string, unknown>;
  try {
    const cuerpo = await request.text();
    if (cuerpo.length > 10_000) return new Response(null, { status: 413 });
    datos = JSON.parse(cuerpo);
  } catch {
    return new Response(null, { status: 400 });
  }

  // Campo trampa: los bots lo llenan, las personas no lo ven
  if (texto(datos.sitio_web, 200)) return new Response(null, { status: 204 });

  const ip = ipDe(request, clientAddress);
  const ahora = Date.now();
  const recientes = (envios.get(ip) ?? []).filter((t) => ahora - t < 3_600_000);
  if (recientes.length >= LIMITE_POR_HORA) return new Response(null, { status: 429 });
  envios.set(ip, [...recientes, ahora]);

  const nombre = texto(datos.nombre, 120);
  const servicio = texto(datos.servicio, 120);
  const mensaje = texto(datos.mensaje, 4000);
  if (!nombre || !servicio || !mensaje) return new Response(null, { status: 422 });

  const empresa = texto(datos.empresa, 160);
  const telefono = texto(datos.telefono, 40);
  db.prepare('INSERT INTO mensajes (ts, nombre, empresa, telefono, servicio, mensaje) VALUES (?, ?, ?, ?, ?, ?)').run(
    ahora,
    nombre,
    empresa || null,
    telefono || null,
    servicio,
    mensaje,
  );

  // Aviso a tu correo (sin hacer esperar al visitante)
  void enviarCorreo({
    asunto: `Nuevo mensaje en la web: ${servicio} — ${nombre}`,
    texto: [
      'Tienes una nueva consulta desde la web de VenusTech.',
      '',
      `Nombre: ${nombre}`,
      empresa ? `Empresa: ${empresa}` : null,
      telefono ? `Teléfono: ${telefono}` : null,
      `Servicio: ${servicio}`,
      '',
      mensaje,
      '',
      'Respóndela desde el panel: /admin/mensajes',
    ]
      .filter((l) => l !== null)
      .join('\n'),
  });
  return new Response(null, { status: 204 });
};
