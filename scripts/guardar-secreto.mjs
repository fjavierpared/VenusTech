// Guarda una clave cifrada (AES-256-GCM) en el .env de la raíz del proyecto.
// La llave de cifrado vive FUERA del proyecto (por defecto ~/.config/venustech/clave),
// así el .env por sí solo no revela la clave.
//
// Uso: npm run secreto:guardar -- SMTP_PASS      (te pide la clave sin mostrarla)
import { randomBytes, createCipheriv } from 'node:crypto';
import { readFileSync, writeFileSync, existsSync, mkdirSync, chmodSync } from 'node:fs';
import { createInterface } from 'node:readline/promises';
import { stdin, stdout, argv } from 'node:process';
import os from 'node:os';
import path from 'node:path';

const nombre = argv[2];
if (!/^[A-Z][A-Z0-9_]*$/.test(nombre ?? '')) {
  console.error('Indica el nombre de la variable. Ej.: npm run secreto:guardar -- SMTP_PASS');
  process.exit(1);
}

const archivoLlave = process.env.VT_KEY_FILE ?? path.join(os.homedir(), '.config', 'venustech', 'clave');
if (!existsSync(archivoLlave)) {
  mkdirSync(path.dirname(archivoLlave), { recursive: true, mode: 0o700 });
  writeFileSync(archivoLlave, randomBytes(32).toString('base64'), { mode: 0o600 });
  console.log(`Llave nueva creada en ${archivoLlave} (respáldala: sin ella no se puede descifrar).`);
}
chmodSync(archivoLlave, 0o600);
const llave = Buffer.from(readFileSync(archivoLlave, 'utf8').trim(), 'base64');
if (llave.length !== 32) {
  console.error(`La llave en ${archivoLlave} no es válida.`);
  process.exit(1);
}

let secreto;
if (stdin.isTTY) {
  const rl = createInterface({ input: stdin, output: stdout });
  stdout.write(`Valor de ${nombre}: `);
  const original = rl._writeToOutput;
  rl._writeToOutput = () => {};
  secreto = await rl.question('');
  rl._writeToOutput = original;
  stdout.write('\n');
  rl.close();
} else {
  let entrada = '';
  for await (const trozo of stdin) entrada += trozo;
  secreto = entrada.split(/\r?\n/)[0];
}
secreto = secreto.trim();
if (!secreto) {
  console.error('No escribiste ningún valor.');
  process.exit(1);
}

const iv = randomBytes(12);
const cifrador = createCipheriv('aes-256-gcm', llave, iv);
const cifrado = Buffer.concat([cifrador.update(secreto, 'utf8'), cifrador.final()]);
const valor = `v1:${iv.toString('base64url')}:${cifrador.getAuthTag().toString('base64url')}:${cifrado.toString('base64url')}`;

// Reemplaza (o agrega) NOMBRE_ENC en .env y elimina cualquier versión en texto plano
const archivoEnv = path.resolve('.env');
const lineas = existsSync(archivoEnv) ? readFileSync(archivoEnv, 'utf8').split('\n') : [];
const filtradas = lineas.filter((l) => !l.startsWith(`${nombre}=`) && !l.startsWith(`${nombre}_ENC=`));
while (filtradas.length && filtradas.at(-1) === '') filtradas.pop();
filtradas.push(`${nombre}_ENC=${valor}`, '');
writeFileSync(archivoEnv, filtradas.join('\n'), { mode: 0o600 });
chmodSync(archivoEnv, 0o600);
console.log(`Listo: ${nombre} guardado cifrado en .env`);
