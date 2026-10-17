import { defineMiddleware } from 'astro:middleware';

// Rutas que requieren sesión de administrador
const PROTEGIDAS = [/^\/admin(\/|$)/, /^\/api\/admin(\/|$)/];
const PUBLICAS_ADMIN = ['/admin/login', '/admin/recuperar', '/admin/restablecer'].flatMap((r) => [r, `${r}/`]);

export const onRequest = defineMiddleware(async (ctx, next) => {
  const { pathname } = ctx.url;
  const protegida = PROTEGIDAS.some((r) => r.test(pathname)) && !PUBLICAS_ADMIN.includes(pathname);

  // Las páginas estáticas (prerender) no tienen request real: no se toca la BD en el build
  if (ctx.isPrerendered) return next();

  // Mantiene vivo el token de Instagram (se renueva solo cada semana)
  void import('./lib/instagram').then((m) => m.programarRenovacion());

  if (!protegida) return next();

  const { adminDeSesion, COOKIE_SESION } = await import('./lib/auth');
  const admin = adminDeSesion(ctx.cookies.get(COOKIE_SESION)?.value);
  if (!admin) {
    if (pathname.startsWith('/api/')) return Response.json({ error: 'No autorizado' }, { status: 401 });
    return ctx.redirect(`/admin/login?volver=${encodeURIComponent(pathname)}`);
  }
  ctx.locals.admin = admin;

  const res = await next();
  // El panel nunca se guarda en caché ni se indexa
  res.headers.set('Cache-Control', 'no-store');
  res.headers.set('X-Robots-Tag', 'noindex, nofollow');
  return res;
});
