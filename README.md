# VenusTech — Sitio web

**Astro 7 + Tailwind CSS 4 + SQLite** (incluido en Node.js 22, sin instalar nada más).
Las páginas públicas son HTML estático; el panel, el blog y la API corren en el servidor Node.
Pensado para desplegarse en un VPS Ubuntu con Nginx + Docker.

## Comandos

```bash
npm install        # instalar dependencias
npm run dev        # desarrollo en http://localhost:4321
npm run build      # genera el sitio en dist/
npm start          # servidor de producción (después de build)
npm run admin:crear  # crea o cambia el usuario y la contraseña del panel
```

## Panel de control

1. Inicia la web una vez (`npm run dev`) para que se cree la base de datos en `data/`.
2. Crea tu usuario: `npm run admin:crear` (contraseña de al menos 12 caracteres).
3. Entra en `/admin`.

Qué incluye:

- **Resumen:** visitas, visitantes, de dónde llegan, páginas más vistas, dispositivos, clics a WhatsApp e Instagram y lo que más preguntan en el chat. Es analítica propia y sin cookies: no guarda IPs y tus visitas como administrador no se cuentan.
- **Mensajes:** lo que envían por el formulario de contacto, con un botón para responder por WhatsApp.
- **Publicaciones:** el blog. Escribe, inserta imágenes, videos o YouTube y publica: aparece al instante en `/blog` y en el sitemap.
- **Imágenes y videos:** las imágenes se optimizan solas a WebP (máx. 1920 px, sin datos GPS). Videos MP4/WebM de hasta 200 MB.

Todo vive en la carpeta `data/` (`venustech.db` + `uploads/`). **Respáldala**: es lo único que no está en el código.

**¿Olvidaste la contraseña?** En el login usa "¿Olvidaste tu contraseña?": llega un enlace de un solo uso (30 min) a tu correo. Sin correo configurado, el enlace aparece en la terminal. También puedes cambiarla siempre con `npm run admin:crear`.

**Correo (avisos de mensajes y recuperación):** ya configurado con Gmail. La contraseña de aplicación está **cifrada** en `.env` (`SMTP_PASS_ENC`); la llave para descifrarla está fuera del proyecto, en `~/.config/venustech/clave`. Para cambiarla: `npm run secreto:guardar -- SMTP_PASS`. **Respalda esa llave**: sin ella no se puede leer la clave (bastaría con volver a guardarla).

Variables de entorno: `DATA_DIR` (carpeta de datos, por defecto `./data`), `TRUST_PROXY=1` (detrás de Nginx), `PORT` y `HOST`.

## Dónde editar

| Qué | Archivo |
|---|---|
| Teléfono, correo, Instagram, dominio, RIF | `src/data/site.ts` |
| Textos de servicios, FAQ y equipos | `src/data/servicios.ts` |
| Proyectos (un `.md` por caso) | `src/content/proyectos/` |
| Colores y tipografías | `src/styles/global.css` (`@theme`) |
| SEO global y datos estructurados | `src/layouts/BaseLayout.astro` |
| Chat guiado | `src/components/ChatWidget.astro` |

Para agregar un proyecto, copia uno de los `.md` de `src/content/proyectos/` y cambia sus datos.

## Pendientes antes del lanzamiento

- [ ] Dominio definitivo en `src/data/site.ts`, `astro.config.mjs` y `public/robots.txt`
- [ ] En el VPS: copiar `.env` y la llave (`~/.config/venustech/clave` o `VT_KEY_FILE`)
- [ ] Dominio definitivo también en `security.allowedDomains` (`astro.config.mjs`)
