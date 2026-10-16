import type { APIRoute } from 'astro';
import { renderMarkdown } from '../../../lib/publicaciones';

export const prerender = false;

// Protegida por el middleware (/api/admin/*)
export const POST: APIRoute = async ({ request }) => {
  const md = (await request.text()).slice(0, 200_000);
  return new Response(renderMarkdown(md), { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
};
