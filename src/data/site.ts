// Datos del negocio. Edita aquí y se actualiza en toda la web.
export const SITE = {
  name: 'VenusTech',
  legalName: 'Venus Tech F.P.',
  rif: 'V-22.986.547-8',
  owner: 'Francisco Paredes',
  ownerTitle: 'Ingeniero de Sistemas',
  // Se toma de SITE_URL al construir (ver astro.config.mjs)
  url: import.meta.env.SITE.replace(/\/$/, ''),
  tagline: 'Desarrollo web, soporte TI y videovigilancia en Mérida',
  description:
    'Páginas web y sistemas a medida, soporte técnico, servidores, recuperación de datos, cámaras de seguridad y venta de equipos en Mérida, Venezuela.',
  keywords: [
    'VenusTech',
    'Venus Tech Mérida',
    'diseño de páginas web Mérida',
    'desarrollo web Mérida Venezuela',
    'sistemas a medida Venezuela',
    'sistema de facturación',
    'sistema de inventario',
    'soporte técnico Mérida',
    'formateo de laptops Mérida',
    'recuperación de datos Mérida',
    'servidores Linux Proxmox Venezuela',
    'instalación de cámaras de seguridad Mérida',
    'venta de equipos de computación Mérida',
    'instalación AutoCAD Revit SketchUp',
    'ingeniero de sistemas Mérida',
  ],
  city: 'Mérida',
  region: 'Mérida',
  country: 'Venezuela',
  countryCode: 'VE',
  // Coordenadas aproximadas del centro de Mérida (para el schema LocalBusiness)
  geo: { lat: 8.5897, lng: -71.1561 },
  yearsExperience: 5,
  whatsapp: '584247126299',
  phone: '+58 424-7126299',
  phoneDisplay: '0424-712 6299',
  email: 'venustech47@gmail.com',
  instagram: 'venustech47',
  responseTime: 'Respondo en menos de 24 horas hábiles.',
} as const;

export const instagramUrl = `https://www.instagram.com/${SITE.instagram}/`;

export function waLink(message = 'Hola, vengo de la web de VenusTech.') {
  return `https://wa.me/${SITE.whatsapp}?text=${encodeURIComponent(message)}`;
}

export const NAV = [
  { href: '/servicios', label: 'Servicios' },
  { href: '/equipos', label: 'Equipos' },
  { href: '/proyectos', label: 'Proyectos' },
  { href: '/blog', label: 'Blog' },
  { href: '/sobre-venustech', label: 'Sobre VenusTech' },
  { href: '/contacto', label: 'Contacto' },
] as const;

export const TECNOLOGIAS = [
  'Linux',
  'Debian',
  'Ubuntu',
  'Proxmox',
  'Windows Server',
  'Docker',
  'Nginx',
  'PHP',
  'JavaScript',
  'MySQL',
  'PostgreSQL',
  'Redes',
  'Cámaras IP',
  'AutoCAD',
  'Revit',
  'SketchUp',
];
