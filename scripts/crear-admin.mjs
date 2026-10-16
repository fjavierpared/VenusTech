// Crea o actualiza el usuario administrador del panel.
// Uso: npm run admin:crear
import { DatabaseSync } from 'node:sqlite';
import { randomBytes, scryptSync } from 'node:crypto';
import { mkdirSync, existsSync } from 'node:fs';
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import path from 'node:path';

const DATA_DIR = path.resolve(process.env.DATA_DIR ?? './data');
const dbPath = path.join(DATA_DIR, 'venustech.db');
mkdirSync(DATA_DIR, { recursive: true });

if (!existsSync(dbPath)) {
  console.error('No existe la base de datos todavía. Inicia la web una vez (npm run dev o npm start) y vuelve a ejecutar.');
  process.exit(1);
}

// Interactivo en la terminal; también acepta las 3 líneas por tubería (usuario, clave, clave)
let usuario, password, repetir;
if (stdin.isTTY) {
  const rl = createInterface({ input: stdin, output: stdout });
  const preguntarOculto = async (pregunta) => {
    stdout.write(pregunta);
    const original = rl._writeToOutput;
    rl._writeToOutput = () => {};
    const r = await rl.question('');
    rl._writeToOutput = original;
    stdout.write('\n');
    return r;
  };
  usuario = (await rl.question('Usuario: ')).trim();
  password = await preguntarOculto('Contraseña (mínimo 12 caracteres): ');
  repetir = await preguntarOculto('Repite la contraseña: ');
  rl.close();
} else {
  let entrada = '';
  for await (const trozo of stdin) entrada += trozo;
  [usuario = '', password = '', repetir = ''] = entrada.split(/\r?\n/);
  usuario = usuario.trim();
}

if (!/^[a-zA-Z0-9._-]{3,40}$/.test(usuario)) {
  console.error('Usuario inválido (3 a 40 caracteres: letras, números, punto, guion).');
  process.exit(1);
}

if (password.length < 12) {
  console.error('La contraseña debe tener al menos 12 caracteres.');
  process.exit(1);
}
if (password !== repetir) {
  console.error('Las contraseñas no coinciden.');
  process.exit(1);
}

const sal = randomBytes(16);
const hash = `scrypt$${sal.toString('hex')}$${scryptSync(password, sal, 64, { N: 16384, r: 8, p: 1 }).toString('hex')}`;

const db = new DatabaseSync(dbPath);
db.prepare(
  'INSERT INTO admins (usuario, hash, creado_en) VALUES (?, ?, ?) ON CONFLICT(usuario) DO UPDATE SET hash = excluded.hash',
).run(usuario, hash, Date.now());
// Cerrar sesiones abiertas de ese usuario al cambiar la contraseña
db.prepare('DELETE FROM sesiones WHERE admin_id = (SELECT id FROM admins WHERE usuario = ?)').run(usuario);
console.log(`Listo: administrador "${usuario}" guardado.`);
