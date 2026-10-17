// Sirve los archivos subidos desde el panel. En producción Nginx los puede servir directamente.
import type { APIRoute } from 'astro';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import path from 'node:path';
import { Readable } from 'node:stream';
import { UPLOADS_DIR } from '../../lib/db';
import { ARCHIVO_VALIDO } from '../../lib/medios';

export const prerender = false;

const MIME: Record<string, string> = { webp: 'image/webp', jpg: 'image/jpeg', mp4: 'video/mp4', webm: 'video/webm' };

export const GET: APIRoute = async ({ params, request }) => {
  const archivo = params.archivo ?? '';
  if (!ARCHIVO_VALIDO.test(archivo)) return new Response('No encontrado', { status: 404 });
  const ruta = path.join(UPLOADS_DIR, archivo);
  let tam: number;
  try {
    tam = (await stat(ruta)).size;
  } catch {
    return new Response('No encontrado', { status: 404 });
  }
  const headers = new Headers({
    'Content-Type': MIME[archivo.split('.').pop()!],
    'Cache-Control': 'public, max-age=31536000, immutable',
    'Accept-Ranges': 'bytes',
    'X-Content-Type-Options': 'nosniff',
  });

  // Soporte de rangos para que los videos se puedan adelantar
  const rango = request.headers.get('range')?.match(/^bytes=(\d*)-(\d*)$/);
  if (rango) {
    const inicio = rango[1] ? Number(rango[1]) : 0;
    const fin = rango[2] ? Math.min(Number(rango[2]), tam - 1) : tam - 1;
    if (inicio > fin || inicio >= tam) return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${tam}` } });
    headers.set('Content-Range', `bytes ${inicio}-${fin}/${tam}`);
    headers.set('Content-Length', String(fin - inicio + 1));
    const stream = Readable.toWeb(createReadStream(ruta, { start: inicio, end: fin })) as ReadableStream;
    return new Response(stream, { status: 206, headers });
  }
  headers.set('Content-Length', String(tam));
  return new Response(Readable.toWeb(createReadStream(ruta)) as ReadableStream, { headers });
};
