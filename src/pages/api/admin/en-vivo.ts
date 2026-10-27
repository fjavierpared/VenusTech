// Personas con la web abierta ahora mismo (el panel lo consulta cada 15 s)
import type { APIRoute } from 'astro';
import { enVivo } from '../../../lib/analytics';

export const prerender = false;

export const GET: APIRoute = () => Response.json(enVivo(), { headers: { 'Cache-Control': 'no-store' } });
