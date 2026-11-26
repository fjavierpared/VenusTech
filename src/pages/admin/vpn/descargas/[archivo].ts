import type { APIRoute } from 'astro';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { Readable } from 'node:stream';
import path from 'node:path';
import { DATA_DIR } from '../../../../lib/db';
import { APPS } from '../../../../lib/vpn';

export const prerender = false;

// Descarga privada de los instaladores (la ruta /admin exige sesión: ver middleware).
export const GET: APIRoute = ({ params }) => {
  const app = Object.values(APPS).find((a) => a.archivo === params.archivo);
  if (!app) return new Response('No encontrado', { status: 404 });
  const ruta = path.join(DATA_DIR, 'descargas', app.archivo);
  if (!existsSync(ruta)) return new Response('El instalador no está en el servidor.', { status: 404 });
  return new Response(Readable.toWeb(createReadStream(ruta)) as ReadableStream, {
    headers: {
      'Content-Type': app.tipo,
      'Content-Length': String(statSync(ruta).size),
      'Content-Disposition': `attachment; filename="${app.archivo}"`,
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
};
