import type { APIRoute } from 'astro';
import { soporte } from '../../../lib/vpn';

export const prerender = false;

// GET → { tipo: 'whatsapp' | 'correo', valor } — lo usa el botón "Soporte" de las apps (también antes de entrar).
export const GET: APIRoute = () => Response.json(soporte(), { headers: { 'Cache-Control': 'no-store' } });
