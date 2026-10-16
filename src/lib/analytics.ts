// Analítica propia: sin cookies, sin servicios externos, sin guardar IPs.
// Cada visitante se identifica con un hash de (IP + navegador + sal diaria): se puede contar
// visitantes únicos por día, pero no rastrear a nadie entre días ni identificarlo.
import { createHash, randomBytes } from 'node:crypto';
import { db } from './db';

const BOTS = /bot|crawl|spider|slurp|bingpreview|facebookexternalhit|whatsapp|telegram|preview|headless|lighthouse|curl|wget|python|axios/i;

export const EVENTOS: Record<string, string> = {
  click_whatsapp: 'Clics a WhatsApp',
  click_instagram: 'Clics a Instagram',
  click_correo: 'Clics al correo',
  chat_abierto: 'Chat abierto',
  chat_servicio: 'Servicio elegido en el chat',
  chat_completado: 'Chat completado',
  formulario_enviado: 'Formularios enviados',
};

export function esBot(ua: string) {
  return !ua || BOTS.test(ua);
}

function salDelDia() {
  const hoy = new Date().toISOString().slice(0, 10);
  const fila = db.prepare("SELECT valor FROM ajustes WHERE clave = 'sal_analitica'").get() as { valor: string } | undefined;
  const [dia, sal] = fila?.valor.split(':') ?? [];
  if (dia === hoy && sal) return sal;
  const nueva = randomBytes(16).toString('hex');
  db.prepare("INSERT INTO ajustes (clave, valor) VALUES ('sal_analitica', ?) ON CONFLICT(clave) DO UPDATE SET valor = excluded.valor").run(
    `${hoy}:${nueva}`,
  );
  return nueva;
}

export function idVisitante(ip: string, ua: string) {
  return createHash('sha256').update(`${salDelDia()}|${ip}|${ua}`).digest('hex').slice(0, 16);
}

export function dispositivoDe(ua: string, ancho?: number) {
  if (/ipad|tablet/i.test(ua) || (ancho && ancho >= 600 && ancho < 1024 && /android/i.test(ua))) return 'Tablet';
  if (/mobi|iphone|android/i.test(ua) || (ancho !== undefined && ancho < 600)) return 'Móvil';
  return 'Escritorio';
}

export function navegadorDe(ua: string) {
  if (/edg\//i.test(ua)) return 'Edge';
  if (/opr\//i.test(ua)) return 'Opera';
  if (/samsungbrowser/i.test(ua)) return 'Samsung Internet';
  if (/chrome|crios/i.test(ua)) return 'Chrome';
  if (/firefox|fxios/i.test(ua)) return 'Firefox';
  if (/safari/i.test(ua)) return 'Safari';
  return 'Otro';
}

const recortar = (s: unknown, max: number) => (typeof s === 'string' ? s.slice(0, max) : null);

export function registrarVisita(datos: {
  ruta: unknown;
  referente: unknown;
  utm: unknown;
  ancho: unknown;
  ua: string;
  ip: string;
  host: string;
}) {
  const ruta = recortar(datos.ruta, 300);
  if (!ruta || !ruta.startsWith('/') || ruta.startsWith('/admin')) return;
  let referente: string | null = null;
  try {
    const host = new URL(String(datos.referente)).hostname.replace(/^www\./, '');
    if (host && host !== datos.host.replace(/^www\./, '').split(':')[0]) referente = host;
  } catch {}
  const ancho = typeof datos.ancho === 'number' ? datos.ancho : undefined;
  db.prepare(
    'INSERT INTO visitas (ts, ruta, referente, utm, dispositivo, navegador, visitante) VALUES (?, ?, ?, ?, ?, ?, ?)',
  ).run(
    Date.now(),
    ruta,
    referente,
    recortar(datos.utm, 100),
    dispositivoDe(datos.ua, ancho),
    navegadorDe(datos.ua),
    idVisitante(datos.ip, datos.ua),
  );
}

export function registrarEvento(datos: { tipo: unknown; detalle: unknown; ruta: unknown; ua: string; ip: string }) {
  const tipo = recortar(datos.tipo, 40);
  if (!tipo || !(tipo in EVENTOS)) return;
  db.prepare('INSERT INTO eventos (ts, tipo, detalle, ruta, visitante) VALUES (?, ?, ?, ?, ?)').run(
    Date.now(),
    tipo,
    recortar(datos.detalle, 120),
    recortar(datos.ruta, 300),
    idVisitante(datos.ip, datos.ua),
  );
}

// ---------- Consultas para el panel ----------

export function resumen(dias: number) {
  const desde = Date.now() - dias * 86_400_000;
  const desdeAnterior = desde - dias * 86_400_000;
  const contar = (sql: string, ...p: (number | string)[]) => (db.prepare(sql).get(...p) as { n: number }).n;

  const visitas = contar('SELECT COUNT(*) n FROM visitas WHERE ts >= ?', desde);
  const visitasAnt = contar('SELECT COUNT(*) n FROM visitas WHERE ts >= ? AND ts < ?', desdeAnterior, desde);
  // Visitantes únicos por día (el hash cambia cada día), sumados en el periodo
  const visitantes = contar(
    "SELECT COUNT(*) n FROM (SELECT DISTINCT visitante, date(ts/1000, 'unixepoch', 'localtime') FROM visitas WHERE ts >= ?)",
    desde,
  );
  const whatsapp = contar("SELECT COUNT(*) n FROM eventos WHERE tipo = 'click_whatsapp' AND ts >= ?", desde);
  const mensajes = contar('SELECT COUNT(*) n FROM mensajes WHERE ts >= ?', desde);
  const mensajesNuevos = contar("SELECT COUNT(*) n FROM mensajes WHERE estado = 'nuevo'");

  const porDia = db
    .prepare(
      `SELECT date(ts/1000, 'unixepoch', 'localtime') dia, COUNT(*) visitas, COUNT(DISTINCT visitante) visitantes
       FROM visitas WHERE ts >= ? GROUP BY dia ORDER BY dia`,
    )
    .all(desde) as { dia: string; visitas: number; visitantes: number }[];

  // Rellenar los días sin visitas para que el gráfico no salte fechas
  const mapa = new Map(porDia.map((d) => [d.dia, d]));
  const serie: { dia: string; visitas: number; visitantes: number }[] = [];
  for (let i = dias - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86_400_000);
    const clave = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    serie.push(mapa.get(clave) ?? { dia: clave, visitas: 0, visitantes: 0 });
  }

  const top = (sql: string) => db.prepare(sql).all(desde) as { etiqueta: string; n: number }[];

  return {
    visitas,
    visitasAnt,
    visitantes,
    whatsapp,
    mensajes,
    mensajesNuevos,
    serie,
    paginas: top('SELECT ruta etiqueta, COUNT(*) n FROM visitas WHERE ts >= ? GROUP BY ruta ORDER BY n DESC LIMIT 10'),
    referentes: top(
      "SELECT COALESCE(referente, 'Directo / sin referencia') etiqueta, COUNT(*) n FROM visitas WHERE ts >= ? GROUP BY etiqueta ORDER BY n DESC LIMIT 8",
    ),
    dispositivos: top('SELECT dispositivo etiqueta, COUNT(*) n FROM visitas WHERE ts >= ? GROUP BY dispositivo ORDER BY n DESC'),
    navegadores: top('SELECT navegador etiqueta, COUNT(*) n FROM visitas WHERE ts >= ? GROUP BY navegador ORDER BY n DESC LIMIT 6'),
    eventos: top('SELECT tipo etiqueta, COUNT(*) n FROM eventos WHERE ts >= ? GROUP BY tipo ORDER BY n DESC'),
    chatServicios: top(
      "SELECT detalle etiqueta, COUNT(*) n FROM eventos WHERE tipo = 'chat_servicio' AND ts >= ? GROUP BY detalle ORDER BY n DESC",
    ),
  };
}
