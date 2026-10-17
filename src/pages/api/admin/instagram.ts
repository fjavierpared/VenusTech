// Estado de la publicación en Instagram (el editor lo consulta mientras se comparte)
import type { APIRoute } from 'astro';
import { estado } from '../../../lib/instagram';

export const prerender = false;

export const GET: APIRoute = ({ url }) => {
  const e = estado(Number(url.searchParams.get('id')));
  return e ? Response.json(e) : Response.json({ error: 'No existe' }, { status: 404 });
};
