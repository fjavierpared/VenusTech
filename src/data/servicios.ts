import type { IconName } from '../components/Icon.astro';

export interface Servicio {
  slug: string;
  icon: IconName;
  nombre: string;
  resumen: string;
  // SEO
  seoTitle: string;
  seoDescription: string;
  // Página
  h1: string;
  intro: string;
  paraQuien: string[];
  incluye: string[];
  proceso: { titulo: string; texto: string }[];
  tecnologias: string[];
  faqs: { q: string; a: string }[];
  waMensaje: string;
}

export const SERVICIOS: Servicio[] = [
  {
    slug: 'desarrollo-web',
    icon: 'code',
    nombre: 'Desarrollo web y sistemas a medida',
    resumen:
      'Páginas web profesionales y sistemas a medida: facturación, inventarios, control de asistencia y paneles de administración.',
    seoTitle: 'Diseño de páginas web y sistemas a medida en Mérida',
    seoDescription:
      'Diseño de páginas web y sistemas a medida en Mérida, Venezuela: facturación, inventarios, control de asistencia y paneles de administración.',
    h1: 'Páginas web y sistemas a medida que trabajan para tu negocio',
    intro:
      'Diseño páginas web rápidas y profesionales, y desarrollo sistemas web a la medida de tu operación. Como también administro servidores, me encargo de que tu proyecto quede publicado, seguro y funcionando, no solo "entregado".',
    paraQuien: [
      'Negocios y emprendedores que necesitan una presencia profesional en internet y aparecer en Google.',
      'Empresas que todavía llevan facturación, inventario o asistencia en papel o en hojas de cálculo.',
      'Organizaciones que necesitan un sistema propio, adaptado a su forma de trabajar.',
    ],
    incluye: [
      'Páginas web corporativas y landing pages, optimizadas para celular y para Google',
      'Sistemas a medida: facturación, inventarios, control de asistencia, reportes',
      'Paneles de administración con usuarios, roles y permisos',
      'Reportes en PDF y Excel, gráficos y estadísticas en tiempo real',
      'Integraciones con otros sistemas y APIs',
      'Dominio, servidor, certificado SSL, respaldos y mantenimiento',
    ],
    proceso: [
      { titulo: 'Reunión y diagnóstico', texto: 'Entiendo tu negocio, tus procesos y qué quieres lograr con la web o el sistema.' },
      { titulo: 'Propuesta y diseño', texto: 'Te presento alcance, plazos y costo, y diseñamos juntos la estructura y el aspecto.' },
      { titulo: 'Desarrollo y pruebas', texto: 'Construyo el proyecto por etapas para que veas avances y lo probamos a fondo.' },
      { titulo: 'Publicación y soporte', texto: 'Lo publico en un servidor seguro, te capacito y te acompaño después del lanzamiento.' },
    ],
    tecnologias: ['PHP', 'JavaScript', 'Astro', 'MySQL', 'PostgreSQL', 'Bootstrap', 'Tailwind CSS', 'Docker', 'Nginx', 'Linux'],
    faqs: [
      {
        q: '¿Cuánto cuesta una página web o un sistema?',
        a: 'Depende del alcance: no es lo mismo una página informativa que un sistema con usuarios, inventario y reportes. Cuéntame qué necesitas y te envío una propuesta con costo y plazo claros, sin compromiso.',
      },
      {
        q: '¿Cuánto tiempo tarda el desarrollo?',
        a: 'Depende de las páginas o módulos que necesites. En la propuesta te doy un plazo concreto y te muestro avances durante todo el proceso.',
      },
      {
        q: '¿La página se verá bien en el celular?',
        a: 'Sí. Diseño primero para celular, porque es desde donde llega la mayoría de tus clientes, y luego adapto a tablet y computadora.',
      },
      {
        q: '¿Mi página va a aparecer en Google?',
        a: 'La construyo con buenas prácticas de SEO desde el inicio: velocidad, estructura, metadatos y datos estructurados. También te ayudo a crear tu perfil de empresa en Google.',
      },
      {
        q: '¿Te encargas del dominio y del hosting?',
        a: 'Sí. Registro o configuro tu dominio, publico el proyecto en un servidor con certificado SSL y me encargo de los respaldos y el mantenimiento.',
      },
      {
        q: '¿Trabajas con clientes fuera de Mérida?',
        a: 'Sí. El desarrollo web lo hago de forma 100 % remota para cualquier parte de Venezuela o el exterior.',
      },
    ],
    waMensaje: 'Hola, vengo de la web de VenusTech. Me interesa una página web o sistema a medida.',
  },
  {
    slug: 'soporte-tecnico-infraestructura',
    icon: 'server',
    nombre: 'Soporte técnico e infraestructura TI',
    resumen:
      'Formateo y mantenimiento de equipos, recuperación de información, servidores Linux, Proxmox y Windows, redes e instalación de programas BIM.',
    seoTitle: 'Soporte técnico y servidores en Mérida',
    seoDescription:
      'Soporte técnico en Mérida: formateo y mantenimiento de equipos, recuperación de datos, servidores Linux, Proxmox y Windows, redes y programas BIM.',
    h1: 'Soporte técnico e infraestructura TI estable, segura y documentada',
    intro: `Desde el mantenimiento de tu laptop hasta la administración de servidores Linux, Proxmox y Windows. Llevo 5 años en soporte técnico y servidores: busco la causa real del problema, lo resuelvo y te dejo todo documentado.`,
    paraQuien: [
      'Oficinas y comercios que no pueden detenerse por una falla de equipos, red o servidor.',
      'Estudios de arquitectura e ingeniería que necesitan equipos listos para AutoCAD, Revit y SketchUp.',
      'Personas y profesionales con equipos lentos, con virus o con información perdida.',
    ],
    incluye: [
      'Formateo, optimización y mantenimiento de laptops y PC de escritorio',
      'Recuperación de información perdida por formateos erróneos o virus (malware)',
      'Instalación y administración de servidores Linux (Debian, Ubuntu) y Windows',
      'Virtualización con Proxmox: varios servidores en un solo equipo',
      'Redes cableadas y Wi-Fi, configuración de routers y módems',
      'Instalación de AutoCAD, Revit, SketchUp y programas de diseño',
      'Respaldos automáticos y planes de mantenimiento preventivo',
    ],
    proceso: [
      { titulo: 'Diagnóstico', texto: 'Reviso el equipo, la red o el servidor y encuentro la causa real del problema.' },
      { titulo: 'Propuesta', texto: 'Te explico en palabras claras qué pasa, cómo lo resuelvo y cuánto cuesta.' },
      { titulo: 'Solución', texto: 'Hago el trabajo, lo pruebo contigo y documento lo que configuré.' },
      { titulo: 'Prevención', texto: 'Te recomiendo respaldos y mantenimiento para que no vuelva a pasar.' },
    ],
    tecnologias: ['Linux', 'Debian', 'Ubuntu', 'Proxmox', 'Windows', 'Windows Server', 'Docker', 'Redes', 'AutoCAD', 'Revit', 'SketchUp'],
    faqs: [
      {
        q: '¿Puedes recuperar archivos de un disco formateado o con virus?',
        a: 'En muchos casos sí, siempre que no se haya escrito información nueva encima. Lo más importante: deja de usar el disco y contáctame cuanto antes. Primero hago un diagnóstico y te digo qué se puede recuperar.',
      },
      {
        q: '¿Atiendes a domicilio u oficina?',
        a: 'Sí, en Mérida atiendo de forma presencial. Fuera de Mérida doy soporte remoto, y la administración de servidores la puedo hacer a distancia desde cualquier lugar.',
      },
      {
        q: '¿Qué es Proxmox y por qué le conviene a mi empresa?',
        a: 'Es una plataforma de virtualización: permite tener varios servidores (archivos, sistemas, bases de datos) en un solo equipo físico, con respaldos y recuperación mucho más sencillos. Ahorras hardware y ganas control.',
      },
      {
        q: '¿Instalas programas como AutoCAD, Revit o SketchUp?',
        a: 'Sí. Instalo y configuro software BIM y de diseño, y te asesoro sobre el equipo que necesitas para trabajar con fluidez.',
      },
      {
        q: '¿Cada cuánto debo hacerle mantenimiento a mis equipos?',
        a: 'Para la mayoría de oficinas recomiendo un mantenimiento preventivo cada 6 meses, y respaldos automáticos de la información importante siempre.',
      },
    ],
    waMensaje: 'Hola, vengo de la web de VenusTech. Necesito soporte técnico / infraestructura.',
  },
  {
    slug: 'camaras-de-seguridad',
    icon: 'cctv',
    nombre: 'Seguridad y videovigilancia',
    resumen:
      'Instalación de cámaras de seguridad con grabación confiable y acceso remoto seguro desde tu celular.',
    seoTitle: 'Instalación de cámaras de seguridad en Mérida',
    seoDescription:
      'Instalación de cámaras de seguridad en Mérida, Venezuela: grabación confiable y monitoreo desde el celular con acceso remoto seguro por VPN.',
    h1: 'Cámaras de seguridad con acceso remoto seguro',
    intro:
      'Instalo y configuro sistemas de videovigilancia para negocios y hogares pensando como ingeniero: cobertura bien diseñada, grabación confiable y acceso desde tu celular sin dejar puertas abiertas a intrusos.',
    paraQuien: [
      'Comercios y oficinas que quieren vigilar su local desde cualquier lugar.',
      'Hogares que buscan tranquilidad con un sistema bien instalado.',
      'Negocios con cámaras ya instaladas que fallan, no graban o no se pueden ver en el celular.',
    ],
    incluye: [
      'Visita al lugar y diseño de la cobertura (qué cámara va dónde y por qué)',
      'Instalación de cámaras IP y grabadores DVR/NVR',
      'Grabación continua o por detección de movimiento',
      'Monitoreo desde el celular con acceso seguro por VPN',
      'Cambio de contraseñas de fábrica y actualización de firmware',
      'Suministro de equipos y mantenimiento periódico',
    ],
    proceso: [
      { titulo: 'Visita técnica', texto: 'Recorro el lugar y detecto los puntos críticos que hay que cubrir.' },
      { titulo: 'Diseño', texto: 'Te propongo la cantidad y el tipo de cámaras, la grabación y el acceso remoto.' },
      { titulo: 'Instalación', texto: 'Instalo, configuro y dejo funcionando la visualización en tu celular.' },
      { titulo: 'Seguimiento', texto: 'Reviso que todo grabe bien y doy mantenimiento cuando lo necesites.' },
    ],
    tecnologias: ['Cámaras IP', 'DVR / NVR', 'VPN', 'Redes', 'Routers', 'UPS'],
    faqs: [
      {
        q: '¿Puedo ver mis cámaras desde el celular?',
        a: 'Sí. Te dejo configurada la app en tu teléfono para ver en vivo y revisar grabaciones desde donde estés.',
      },
      {
        q: '¿Por qué recomiendas el acceso por VPN?',
        a: 'Muchas instalaciones abren puertos del router para ver las cámaras desde afuera. Eso deja el grabador expuesto a internet y es una de las formas más comunes en que se hackean cámaras. Con una VPN, solo tú puedes acceder.',
      },
      {
        q: '¿También vendes las cámaras?',
        a: 'Sí. Te suministro los equipos y te asesoro para elegir los adecuados según el lugar y tu presupuesto.',
      },
      {
        q: '¿Qué pasa si se va la luz?',
        a: 'Recomiendo conectar el grabador y el router a un UPS para que el sistema siga grabando durante los cortes eléctricos.',
      },
      {
        q: '¿Atiendes fuera de Mérida?',
        a: 'La instalación es presencial en Mérida. La configuración y el soporte remoto los puedo hacer desde cualquier lugar.',
      },
    ],
    waMensaje: 'Hola, vengo de la web de VenusTech. Me interesa la instalación de cámaras de seguridad.',
  },
];

export const EQUIPOS = [
  { icon: 'monitor', nombre: 'PC de escritorio', texto: 'Para oficina, diseño, BIM o uso en casa.' },
  { icon: 'laptop', nombre: 'Laptops', texto: 'Te ayudo a elegir según lo que vas a hacer.' },
  { icon: 'hard-drive', nombre: 'Discos duros y SSD', texto: 'Más velocidad y espacio para tu equipo.' },
  { icon: 'cpu', nombre: 'Memoria RAM', texto: 'La forma más económica de acelerar un equipo.' },
  { icon: 'battery', nombre: 'UPS y mini UPS', texto: 'Protección ante cortes y bajones de luz.' },
  { icon: 'router', nombre: 'Routers y módems', texto: 'Internet estable y Wi-Fi con buena cobertura.' },
  { icon: 'printer', nombre: 'Impresoras', texto: 'Instaladas y configuradas en tu red.' },
  { icon: 'cctv', nombre: 'Cámaras de seguridad', texto: 'Con instalación y configuración profesional.' },
] as const;
