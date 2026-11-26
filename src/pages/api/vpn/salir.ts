import type { APIRoute } from 'astro';
import { logoutApp } from '../../../lib/vpn';
import { tokenDe } from './_comun';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  logoutApp(tokenDe(request));
  return new Response(null, { status: 204 });
};
