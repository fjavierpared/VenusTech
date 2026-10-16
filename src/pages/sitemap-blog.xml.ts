// Sitemap dinámico del blog: Google ve cada publicación nueva sin reconstruir la web
import type { APIRoute } from 'astro';
import { publicadas } from '../lib/publicaciones';
import { SITE } from '../data/site';

export const prerender = false;

export const GET: APIRoute = () => {
  const urls = [
    `<url><loc>${SITE.url}/blog</loc></url>`,
    ...publicadas(1000).map(
      (p) => `<url><loc>${SITE.url}/blog/${p.slug}</loc><lastmod>${new Date(p.actualizado_en).toISOString()}</lastmod></url>`,
    ),
  ];
  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.join('')}</urlset>`,
    { headers: { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'public, max-age=600' } },
  );
};
