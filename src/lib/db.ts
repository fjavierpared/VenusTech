// Base de datos SQLite incluida en Node.js (node:sqlite): sin instalar ningún motor.
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import path from 'node:path';

export const DATA_DIR = path.resolve(process.env.DATA_DIR ?? './data');
export const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');

mkdirSync(UPLOADS_DIR, { recursive: true });

// Migraciones en orden. Nunca edites una ya aplicada: agrega una nueva al final.
const MIGRACIONES = [
  `
  CREATE TABLE admins (
    id INTEGER PRIMARY KEY,
    usuario TEXT NOT NULL UNIQUE,
    hash TEXT NOT NULL,
    creado_en INTEGER NOT NULL
  );
  CREATE TABLE sesiones (
    token_hash TEXT PRIMARY KEY,
    admin_id INTEGER NOT NULL REFERENCES admins(id) ON DELETE CASCADE,
    expira_en INTEGER NOT NULL,
    creado_en INTEGER NOT NULL
  );
  CREATE TABLE intentos_login (
    ip TEXT NOT NULL,
    ts INTEGER NOT NULL
  );
  CREATE INDEX idx_intentos_ip_ts ON intentos_login(ip, ts);

  CREATE TABLE ajustes (
    clave TEXT PRIMARY KEY,
    valor TEXT NOT NULL
  );

  CREATE TABLE visitas (
    id INTEGER PRIMARY KEY,
    ts INTEGER NOT NULL,
    ruta TEXT NOT NULL,
    referente TEXT,
    utm TEXT,
    dispositivo TEXT NOT NULL,
    navegador TEXT NOT NULL,
    visitante TEXT NOT NULL
  );
  CREATE INDEX idx_visitas_ts ON visitas(ts);

  CREATE TABLE eventos (
    id INTEGER PRIMARY KEY,
    ts INTEGER NOT NULL,
    tipo TEXT NOT NULL,
    detalle TEXT,
    ruta TEXT,
    visitante TEXT NOT NULL
  );
  CREATE INDEX idx_eventos_ts ON eventos(ts);

  CREATE TABLE mensajes (
    id INTEGER PRIMARY KEY,
    ts INTEGER NOT NULL,
    nombre TEXT NOT NULL,
    empresa TEXT,
    telefono TEXT,
    servicio TEXT NOT NULL,
    mensaje TEXT NOT NULL,
    estado TEXT NOT NULL DEFAULT 'nuevo'
  );

  CREATE TABLE medios (
    id INTEGER PRIMARY KEY,
    archivo TEXT NOT NULL UNIQUE,
    nombre_original TEXT NOT NULL,
    tipo TEXT NOT NULL,
    mime TEXT NOT NULL,
    bytes INTEGER NOT NULL,
    ancho INTEGER,
    alto INTEGER,
    alt TEXT NOT NULL DEFAULT '',
    creado_en INTEGER NOT NULL
  );

  CREATE TABLE publicaciones (
    id INTEGER PRIMARY KEY,
    slug TEXT NOT NULL UNIQUE,
    titulo TEXT NOT NULL,
    resumen TEXT NOT NULL DEFAULT '',
    contenido TEXT NOT NULL DEFAULT '',
    portada TEXT,
    estado TEXT NOT NULL DEFAULT 'borrador',
    publicado_en INTEGER,
    creado_en INTEGER NOT NULL,
    actualizado_en INTEGER NOT NULL
  );
  CREATE INDEX idx_publicaciones_estado ON publicaciones(estado, publicado_en);
  `,
  `
  CREATE TABLE recuperaciones (
    token_hash TEXT PRIMARY KEY,
    admin_id INTEGER NOT NULL REFERENCES admins(id) ON DELETE CASCADE,
    expira_en INTEGER NOT NULL,
    creado_en INTEGER NOT NULL,
    usado INTEGER NOT NULL DEFAULT 0
  );
  `,
  `
  ALTER TABLE publicaciones ADD COLUMN ig_compartir INTEGER NOT NULL DEFAULT 0;
  ALTER TABLE publicaciones ADD COLUMN ig_texto TEXT NOT NULL DEFAULT '';
  ALTER TABLE publicaciones ADD COLUMN ig_estado TEXT NOT NULL DEFAULT '';
  ALTER TABLE publicaciones ADD COLUMN ig_error TEXT;
  ALTER TABLE publicaciones ADD COLUMN ig_permalink TEXT;
  ALTER TABLE publicaciones ADD COLUMN ig_publicado_en INTEGER;
  `,
  `
  ALTER TABLE publicaciones ADD COLUMN ig_video TEXT;
  `,
];

function abrir() {
  const db = new DatabaseSync(path.join(DATA_DIR, 'venustech.db'));
  db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;');
  const { user_version: version } = db.prepare('PRAGMA user_version').get() as { user_version: number };
  for (let i = version; i < MIGRACIONES.length; i++) {
    db.exec('BEGIN');
    try {
      db.exec(MIGRACIONES[i]);
      db.exec(`PRAGMA user_version = ${i + 1}`);
      db.exec('COMMIT');
    } catch (e) {
      db.exec('ROLLBACK');
      throw e;
    }
  }
  return db;
}

// Una sola conexión por proceso (también entre recargas en desarrollo)
const g = globalThis as unknown as { __vtDb?: DatabaseSync };
export const db = (g.__vtDb ??= abrir());
