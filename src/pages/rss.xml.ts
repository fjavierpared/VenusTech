// Feed RSS del blog: lectores de noticias y automatizaciones (Make, Zapier, Buffer) lo leen para avisar o publicar.
import type { APIRoute } from 'astro';
import { SITE } from '../data/site';
import { publicadas } from '../lib/publicaciones';

export const prerender = false;

const xml = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export const GET: APIRoute = () => {
  const items = publicadas(30)
    .map((p) => {
      const url = `${SITE.url}/blog/${p.slug}`;
      return `
    <item>
      <title>${xml(p.titulo)}</title>
      <link>${url}</link>
      <guid isPermaLink="true">${url}</guid>
      <pubDate>${new Date(p.publicado_en!).toUTCString()}</pubDate>
      <description>${xml(p.resumen)}</description>${
        p.portada ? `\n      <enclosure url="${url}/instagram.jpg" type="image/jpeg" length="0" />` : ''
      }
    </item>`;
    })
    .join('');
  const cuerpo = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>Blog de ${SITE.name}</title>
    <link>${SITE.url}/blog</link>
    <description>${xml(SITE.description)}</description>
    <language>es-VE</language>
    <atom:link href="${SITE.url}/rss.xml" rel="self" type="application/rss+xml" />${items}
  </channel>
</rss>
`;
  return new Response(cuerpo, {
    headers: { 'Content-Type': 'application/rss+xml; charset=utf-8', 'Cache-Control': 'public, max-age=300' },
  });
};
