import type { APIRoute } from 'astro';
import { cerrarSesion, COOKIE_SESION } from '../../lib/auth';

export const prerender = false;

export const POST: APIRoute = ({ cookies, redirect }) => {
  cerrarSesion(cookies.get(COOKIE_SESION)?.value);
  cookies.delete(COOKIE_SESION, { path: '/' });
  return redirect('/admin/login');
};
