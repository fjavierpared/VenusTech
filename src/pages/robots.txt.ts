// robots.txt generado con el dominio configurado en SITE_URL
import type { APIRoute } from 'astro';

export const GET: APIRoute = ({ site }) => {
  const base = site!.href.replace(/\/$/, '');
  return new Response(
    `User-agent: *
Allow: /
Disallow: /admin
Disallow: /api/

Sitemap: ${base}/sitemap-index.xml
Sitemap: ${base}/sitemap-blog.xml
`,
    { headers: { 'Content-Type': 'text/plain; charset=utf-8' } },
  );
};
