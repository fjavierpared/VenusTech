// Lee variables de entorno, descifrando las que vienen como NOMBRE_ENC (ver scripts/guardar-secreto.mjs)
import { createDecipheriv } from 'node:crypto';
import { readFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

function crudo(nombre: string): string | undefined {
  return process.env[nombre] || (import.meta.env as Record<string, string | undefined>)[nombre] || undefined;
}

let llave: Buffer | null | undefined;
function obtenerLlave() {
  if (llave !== undefined) return llave;
  const archivo = crudo('VT_KEY_FILE') ?? path.join(os.homedir(), '.config', 'venustech', 'clave');
  try {
    const b = Buffer.from(readFileSync(archivo, 'utf8').trim(), 'base64');
    llave = b.length === 32 ? b : null;
  } catch {
    llave = null;
  }
  if (!llave) console.error(`No se encontró la llave de cifrado en ${archivo}: no se pueden leer las claves cifradas.`);
  return llave;
}

function descifrar(valor: string): string | undefined {
  const [version, iv, tag, datos] = valor.split(':');
  const k = obtenerLlave();
  if (version !== 'v1' || !iv || !tag || !datos || !k) return undefined;
  try {
    const d = createDecipheriv('aes-256-gcm', k, Buffer.from(iv, 'base64url'));
    d.setAuthTag(Buffer.from(tag, 'base64url'));
    return Buffer.concat([d.update(Buffer.from(datos, 'base64url')), d.final()]).toString('utf8');
  } catch {
    console.error('No se pudo descifrar una clave: ¿cambió la llave de cifrado?');
    return undefined;
  }
}

/** Valor de una variable de entorno; si existe NOMBRE_ENC, la devuelve descifrada */
export function env(nombre: string): string | undefined {
  const cifrado = crudo(`${nombre}_ENC`);
  return cifrado ? descifrar(cifrado) : crudo(nombre);
}
