// Analítica propia: sin cookies, sin servicios externos, sin guardar IPs.
// Cada navegador guarda un código anónimo al azar (localStorage) para reconocer visitas que regresan.
// Si no se puede guardar, se usa un hash de (IP + navegador + sal diaria) que cambia cada día.
// La ubicación (país y ciudad aproximados) la calcula Cloudflare a partir de la IP; la IP nunca se guarda.
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

export function sistemaDe(ua: string) {
  if (/iphone|ipad|ipod/i.test(ua)) return 'iOS';
  if (/android/i.test(ua)) return 'Android';
  if (/cros/i.test(ua)) return 'ChromeOS';
  if (/windows/i.test(ua)) return 'Windows';
  if (/mac os x|macintosh/i.test(ua)) return 'macOS';
  if (/linux/i.test(ua)) return 'Linux';
  return 'Otro';
}

const recortar = (s: unknown, max: number) => (typeof s === 'string' ? s.slice(0, max) : null);
const ID_VALIDO = /^[a-f0-9]{16}$/;
const idCliente = (v: unknown) => (typeof v === 'string' && ID_VALIDO.test(v) ? v : null);
const SESION_MAX = 30 * 60_000; // 30 min sin actividad = nueva visita

// Los encabezados HTTP llegan como latin1: "MÃ©rida" → "Mérida"
function textoHeader(v: string | null) {
  if (!v) return null;
  let t = v;
  try {
    t = decodeURIComponent(t);
  } catch {}
  if (/[\u00c2-\u00f4][\u0080-\u00bf]/.test(t)) {
    const utf8 = Buffer.from(t, 'latin1').toString('utf8');
    if (!utf8.includes('\ufffd')) t = utf8;
  }
  return t.trim().slice(0, 80) || null;
}

/** País, región y ciudad aproximados que agrega Cloudflare (la ciudad requiere "Add visitor location headers"). */
export function ubicacionDe(headers: Headers) {
  const pais = headers.get('cf-ipcountry')?.toUpperCase() ?? null;
  return {
    pais: pais && /^[A-Z]{2}$/.test(pais) && pais !== 'XX' ? pais : null,
    region: textoHeader(headers.get('cf-region')),
    ciudad: textoHeader(headers.get('cf-ipcity')),
  };
}

const nombresPais = new Intl.DisplayNames(['es'], { type: 'region' });
export function nombrePais(codigo: string | null) {
  if (!codigo) return null;
  try {
    return nombresPais.of(codigo) ?? codigo;
  } catch {
    return codigo;
  }
}

export function lugar(v: { ciudad: string | null; region?: string | null; pais: string | null }) {
  const partes = [v.ciudad, v.region && v.region !== v.ciudad ? v.region : null, nombrePais(v.pais)].filter(Boolean);
  return partes.length ? partes.join(', ') : 'Ubicación desconocida';
}

export function registrarVisita(datos: {
  ruta: unknown;
  referente: unknown;
  utm: unknown;
  ancho: unknown;
  v: unknown;
  pv: unknown;
  idioma: unknown;
  pantalla: unknown;
  ua: string;
  ip: string;
  host: string;
  headers: Headers;
}) {
  const ruta = recortar(datos.ruta, 300);
  if (!ruta || !ruta.startsWith('/') || ruta.startsWith('/admin')) return;
  let referente: string | null = null;
  try {
    const host = new URL(String(datos.referente)).hostname.replace(/^www\./, '');
    if (host && host !== datos.host.replace(/^www\./, '').split(':')[0]) referente = host;
  } catch {}
  const ancho = typeof datos.ancho === 'number' ? datos.ancho : undefined;
  const ahora = Date.now();
  const visitante = idCliente(datos.v) ?? idVisitante(datos.ip, datos.ua);
  const pv = idCliente(datos.pv);
  // Misma visita (sesión) si el visitante tuvo actividad en los últimos 30 minutos
  const previa = db
    .prepare('SELECT sesion FROM visitas WHERE visitante = ? AND COALESCE(ultimo, ts) >= ? AND sesion IS NOT NULL ORDER BY ts DESC LIMIT 1')
    .get(visitante, ahora - SESION_MAX) as { sesion: string } | undefined;
  const { pais, region, ciudad } = ubicacionDe(datos.headers);
  const pantalla = typeof datos.pantalla === 'string' && /^\d{2,5}x\d{2,5}$/.test(datos.pantalla) ? datos.pantalla : null;
  const idioma = typeof datos.idioma === 'string' && /^[a-zA-Z]{2,3}(-[a-zA-Z0-9]{2,8})?$/.test(datos.idioma) ? datos.idioma : null;
  db.prepare(
    `INSERT INTO visitas (ts, ruta, referente, utm, dispositivo, navegador, visitante, pv, sesion, pais, region, ciudad, so, idioma, pantalla, ultimo)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    ahora,
    ruta,
    referente,
    recortar(datos.utm, 100),
    dispositivoDe(datos.ua, ancho),
    navegadorDe(datos.ua),
    visitante,
    pv,
    previa?.sesion ?? pv ?? `${visitante}-${ahora}`,
    pais,
    region,
    ciudad,
    sistemaDe(datos.ua),
    idioma,
    pantalla,
    ahora,
  );
}

/** Tiempo activo en la página y hasta dónde bajó (lo envía el navegador cada 30 s y al salir). */
export function registrarActividad(datos: { pv: unknown; dur: unknown; scroll: unknown }) {
  const pv = idCliente(datos.pv);
  const dur = typeof datos.dur === 'number' && datos.dur >= 0 ? Math.min(Math.round(datos.dur), 6 * 3_600_000) : null;
  const scroll = typeof datos.scroll === 'number' ? Math.max(0, Math.min(100, Math.round(datos.scroll))) : null;
  if (!pv || dur === null) return;
  const ahora = Date.now();
  db.prepare(
    'UPDATE visitas SET duracion = MAX(COALESCE(duracion, 0), ?), scroll = MAX(COALESCE(scroll, 0), COALESCE(?, 0)), ultimo = ? WHERE pv = ? AND ts >= ?',
  ).run(dur, scroll, ahora, pv, ahora - 6 * 3_600_000);
}

export function registrarEvento(datos: { tipo: unknown; detalle: unknown; ruta: unknown; v: unknown; ua: string; ip: string }) {
  const tipo = recortar(datos.tipo, 40);
  if (!tipo || !(tipo in EVENTOS)) return;
  db.prepare('INSERT INTO eventos (ts, tipo, detalle, ruta, visitante) VALUES (?, ?, ?, ?, ?)').run(
    Date.now(),
    tipo,
    recortar(datos.detalle, 120),
    recortar(datos.ruta, 300),
    idCliente(datos.v) ?? idVisitante(datos.ip, datos.ua),
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

// ---------- Visitantes a fondo ----------

export interface Visita {
  id: number;
  ts: number;
  ruta: string;
  referente: string | null;
  utm: string | null;
  dispositivo: string;
  navegador: string;
  visitante: string;
  sesion: string | null;
  pais: string | null;
  region: string | null;
  ciudad: string | null;
  so: string | null;
  idioma: string | null;
  pantalla: string | null;
  duracion: number | null;
  scroll: number | null;
  ultimo: number | null;
}

export interface Recorrido {
  sesion: string;
  visitante: string;
  inicio: number;
  fin: number;
  numero: number; // n.º de visita de este visitante
  paginas: Visita[];
}

const CLAVE_SESION = "COALESCE(sesion, visitante || '-' || date(ts/1000, 'unixepoch', 'localtime'))";

export function duracionLegible(ms: number | null) {
  if (!ms || ms < 1000) return '—';
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s} s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min ${s % 60 ? `${s % 60} s` : ''}`.trim();
  return `${Math.floor(m / 60)} h ${m % 60} min`;
}

function agrupar(filas: Visita[]) {
  const mapa = new Map<string, Visita[]>();
  for (const f of filas) {
    const clave = f.sesion ?? `${f.visitante}-${new Date(f.ts).toDateString()}`;
    mapa.set(clave, [...(mapa.get(clave) ?? []), f]);
  }
  return mapa;
}

function armarRecorridos(filas: Visita[]): Recorrido[] {
  const numero = db.prepare(`SELECT COUNT(DISTINCT ${CLAVE_SESION}) n FROM visitas WHERE visitante = ? AND ts <= ?`);
  return [...agrupar(filas).entries()]
    .map(([sesion, paginas]) => {
      paginas.sort((a, b) => a.ts - b.ts);
      const inicio = paginas[0].ts;
      return {
        sesion,
        visitante: paginas[0].visitante,
        inicio,
        fin: Math.max(...paginas.map((p) => p.ultimo ?? p.ts)),
        numero: (numero.get(paginas[0].visitante, inicio) as { n: number }).n,
        paginas,
      };
    })
    .sort((a, b) => b.inicio - a.inicio);
}

/** Últimas visitas completas (página por página), las más recientes primero. */
export function recorridosRecientes(limite = 40) {
  const sesiones = db
    .prepare(`SELECT ${CLAVE_SESION} s FROM visitas GROUP BY s ORDER BY MAX(ts) DESC LIMIT ?`)
    .all(limite) as { s: string }[];
  if (!sesiones.length) return [];
  const filas = db
    .prepare(`SELECT * FROM visitas WHERE ${CLAVE_SESION} IN (${sesiones.map(() => '?').join(',')})`)
    .all(...sesiones.map((x) => x.s)) as unknown as Visita[];
  return armarRecorridos(filas);
}

export function recorridosDe(visitante: string) {
  return armarRecorridos(db.prepare('SELECT * FROM visitas WHERE visitante = ? ORDER BY ts DESC LIMIT 500').all(visitante) as unknown as Visita[]);
}

/** Páginas que vio un visitante en los 30 días antes de un momento (p. ej., antes de escribir). */
export function recorridoAntesDe(visitante: string, ts: number) {
  return db
    .prepare('SELECT * FROM visitas WHERE visitante = ? AND ts <= ? AND ts >= ? ORDER BY ts')
    .all(visitante, ts + 60_000, ts - 30 * 86_400_000) as unknown as Visita[];
}

/** Personas con la web abierta (actividad en los últimos 90 s). */
export function enVivo() {
  const filas = db
    .prepare(
      `SELECT v.* FROM visitas v
       JOIN (SELECT visitante, MAX(ts) ts FROM visitas WHERE COALESCE(ultimo, ts) >= ? GROUP BY visitante) u
         ON u.visitante = v.visitante AND u.ts = v.ts
       ORDER BY v.ts DESC LIMIT 50`,
    )
    .all(Date.now() - 90_000) as unknown as Visita[];
  return filas.map((f) => ({
    visitante: f.visitante,
    ruta: f.ruta,
    lugar: lugar(f),
    dispositivo: f.dispositivo,
    so: f.so,
    referente: f.referente,
    desde: f.ts,
  }));
}

export function detalle(dias: number) {
  const desde = Date.now() - dias * 86_400_000;
  const top = (sql: string) => db.prepare(sql).all(desde) as { etiqueta: string; n: number }[];
  const sesiones = db
    .prepare(
      `SELECT COUNT(*) sesiones, AVG(paginas) paginas, AVG(tiempo) tiempo FROM (
         SELECT ${CLAVE_SESION} s, COUNT(*) paginas, SUM(COALESCE(duracion, 0)) tiempo FROM visitas WHERE ts >= ? GROUP BY s)`,
    )
    .get(desde) as { sesiones: number; paginas: number | null; tiempo: number | null };
  // Recurrente: ya había visitado la web antes del periodo o en otra visita dentro de él
  const visitantes = db
    .prepare(
      `SELECT COUNT(*) total, SUM(CASE WHEN n > 1 THEN 1 ELSE 0 END) recurrentes FROM (
         SELECT visitante, COUNT(DISTINCT ${CLAVE_SESION}) n FROM visitas
         WHERE visitante IN (SELECT DISTINCT visitante FROM visitas WHERE ts >= ?) GROUP BY visitante)`,
    )
    .get(desde) as { total: number; recurrentes: number | null };
  return {
    sesiones: sesiones.sesiones,
    paginasPorVisita: sesiones.paginas ?? 0,
    tiempoPorVisita: sesiones.tiempo ?? 0,
    visitantes: visitantes.total,
    recurrentes: visitantes.recurrentes ?? 0,
    paises: top("SELECT COALESCE(pais, '?') etiqueta, COUNT(*) n FROM visitas WHERE ts >= ? GROUP BY etiqueta ORDER BY n DESC LIMIT 10").map(
      (f) => ({ ...f, etiqueta: f.etiqueta === '?' ? 'Desconocido' : (nombrePais(f.etiqueta) ?? f.etiqueta) }),
    ),
    ciudades: top(
      "SELECT ciudad || COALESCE(' (' || pais || ')', '') etiqueta, COUNT(*) n FROM visitas WHERE ts >= ? AND ciudad IS NOT NULL GROUP BY etiqueta ORDER BY n DESC LIMIT 10",
    ),
    sistemas: top("SELECT COALESCE(so, 'Sin dato') etiqueta, COUNT(*) n FROM visitas WHERE ts >= ? GROUP BY etiqueta ORDER BY n DESC"),
    idiomas: top(
      "SELECT COALESCE(idioma, 'Sin dato') etiqueta, COUNT(*) n FROM visitas WHERE ts >= ? GROUP BY etiqueta ORDER BY n DESC LIMIT 8",
    ),
    pantallas: top(
      'SELECT pantalla etiqueta, COUNT(*) n FROM visitas WHERE ts >= ? AND pantalla IS NOT NULL GROUP BY pantalla ORDER BY n DESC LIMIT 8',
    ),
    blog: db
      .prepare(
        `SELECT ruta, COUNT(*) visitas, AVG(scroll) scroll, AVG(CASE WHEN scroll >= 90 THEN 100.0 ELSE 0 END) completos, AVG(duracion) tiempo
         FROM visitas WHERE ts >= ? AND ruta LIKE '/blog/_%' GROUP BY ruta ORDER BY visitas DESC LIMIT 15`,
      )
      .all(desde) as { ruta: string; visitas: number; scroll: number | null; completos: number; tiempo: number | null }[],
  };
}
