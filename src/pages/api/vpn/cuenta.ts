import type { APIRoute } from 'astro';
import { cuentaApp } from '../../../lib/vpn';
import { responder, sinCache, tokenDe } from './_comun';

export const prerender = false;

// GET (Authorization: Bearer <token>) → datos del plan + configuración del túnel
export const GET: APIRoute = async ({ request }) => {
  try {
    return Response.json(await cuentaApp(tokenDe(request)), { headers: sinCache });
  } catch (e) {
    return responder(e);
  }
};
