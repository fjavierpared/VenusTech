// @ts-check
import { defineConfig } from 'astro/config';
import node from '@astrojs/node';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';

// Dirección pública de la web. Se define al construir (variable SITE_URL en .env o en Docker).
const SITE_URL = (process.env.SITE_URL || 'https://www.venustechfp.com').replace(/\/$/, '');
const { hostname, protocol } = new URL(SITE_URL);
const esquema = protocol.replace(':', '');

export default defineConfig({
  site: SITE_URL,
  // Las páginas públicas se generan como HTML estático (rápidas y óptimas para SEO).
  // Solo el panel, el blog y la API se ejecutan en el servidor (`export const prerender = false`).
  output: 'static',
  adapter: node({ mode: 'standalone', bodySizeLimit: 250 * 1024 * 1024 }),
  integrations: [
    sitemap({
      filter: (page) => !page.includes('/admin'),
    }),
  ],
  security: {
    // Dominios desde los que se aceptan formularios y logins (detrás de Nginx)
    allowedDomains: [
      { hostname, protocol: esquema },
      // También la variante con o sin "www." (Nginx redirige una a la otra)
      ...(/^\d|sslip\.io$|nip\.io$|localhost/.test(hostname)
        ? []
        : [{ hostname: hostname.startsWith('www.') ? hostname.slice(4) : `www.${hostname}`, protocol: esquema }]),
    ],
  },
  vite: { plugins: [tailwindcss()] },
});
