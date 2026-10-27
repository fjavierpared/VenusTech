// Portada de cada artículo en formato Instagram (JPEG 1080×1350, 4:5).
// La usa el feed RSS para que servicios como Make o Zapier puedan publicarla sin tocar la web.
import type { APIRoute } from 'astro';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { UPLOADS_DIR } from '../../../lib/db';
import { ARCHIVO_VALIDO } from '../../../lib/medios';
import { publicadaPorSlug } from '../../../lib/publicaciones';

export const prerender = false;

export const GET: APIRoute = async ({ params }) => {
  const post = publicadaPorSlug(params.slug ?? '');
  const original = post?.portada?.split('/').pop() ?? '';
  if (!post?.portada?.startsWith('/media/') || !ARCHIVO_VALIDO.test(original)) return new Response('No encontrado', { status: 404 });
  try {
    const jpg = await sharp(await readFile(path.join(UPLOADS_DIR, original)))
      .resize({ width: 1080, height: 1350, fit: 'cover', position: 'attention' })
      .flatten({ background: '#ffffff' })
      .jpeg({ quality: 88, mozjpeg: true })
      .toBuffer();
    return new Response(new Uint8Array(jpg), {
      headers: { 'Content-Type': 'image/jpeg', 'Cache-Control': 'public, max-age=86400', 'X-Content-Type-Options': 'nosniff' },
    });
  } catch {
    return new Response('No encontrado', { status: 404 });
  }
};
