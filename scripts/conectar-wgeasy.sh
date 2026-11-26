#!/usr/bin/env bash
# Conecta la web de VenusTech con el panel de wg-easy (VPN privada) en un solo paso:
#  1) genera una clave nueva y segura para el usuario "admin" de wg-easy,
#  2) la prueba y la guarda CIFRADA en el CRM (VPN privada → Conexión),
#  3) deja una copia en ~/VenustechVPN/clave-panel-wgeasy.txt (solo tu usuario puede leerla).
# La clave nunca se muestra en pantalla. No afecta a los usuarios ni dispositivos del VPN.
# Uso:  bash ~/VenusTech/scripts/conectar-wgeasy.sh
set -euo pipefail

docker inspect -f '{{.State.Running}}' venustechvpn 2>/dev/null | grep -q true || { echo "❌ El contenedor venustechvpn no está corriendo."; exit 1; }
docker inspect -f '{{.State.Running}}' venustech-web 2>/dev/null | grep -q true || { echo "❌ El contenedor venustech-web no está corriendo."; exit 1; }

CLAVE=$(openssl rand -base64 24 | tr -d '/+=' | cut -c1-24)

echo "→ Cambiando la clave del panel de wg-easy…"
docker exec venustechvpn cli db:admin:reset --password="$CLAVE" >/dev/null

echo "→ Probándola y guardándola cifrada en el CRM…"
CODIGO=$(cat <<'JS'
const fs = require('fs'), { createCipheriv, randomBytes } = require('crypto'), { DatabaseSync } = require('node:sqlite');
const clave = fs.readFileSync(0, 'utf8').trim(), usuario = 'admin';
const url = (process.env.WG_API_URL || 'http://venustechvpn:51821').replace(/\/$/, '');
(async () => {
  let r;
  for (let i = 0; i < 5; i++) {
    r = await fetch(url + '/api/client', { headers: { Authorization: 'Basic ' + Buffer.from(usuario + ':' + clave).toString('base64') } }).catch(() => null);
    if (r && r.ok) break;
    await new Promise((ok) => setTimeout(ok, 1500));
  }
  if (!r || !r.ok) { console.log('❌ wg-easy no aceptó la clave nueva (' + (r ? r.status : 'sin respuesta') + ').'); process.exit(1); }
  const k = Buffer.from(fs.readFileSync(process.env.VT_KEY_FILE, 'utf8').trim(), 'base64');
  const iv = randomBytes(12), c = createCipheriv('aes-256-gcm', k, iv), d = Buffer.concat([c.update(clave, 'utf8'), c.final()]);
  const cifrada = `v1:${iv.toString('base64url')}:${c.getAuthTag().toString('base64url')}:${d.toString('base64url')}`;
  const db = new DatabaseSync('/data/venustech.db');
  const guardar = db.prepare('INSERT INTO ajustes (clave, valor) VALUES (?, ?) ON CONFLICT(clave) DO UPDATE SET valor = excluded.valor');
  guardar.run('wg_api_user', usuario);
  guardar.run('wg_api_password', cifrada);
  console.log('✅ Web conectada con el VPN. Dispositivos en el VPN: ' + (await r.json()).length);
})();
JS
)
printf '%s' "$CLAVE" | docker exec -i venustech-web node --no-warnings -e "$CODIGO"

( umask 077; printf 'Panel wg-easy (VPN privada)\nUsuario: admin\nClave:   %s\n' "$CLAVE" > "$HOME/VenustechVPN/clave-panel-wgeasy.txt" )
unset CLAVE
echo "✅ Copia de la clave en ~/VenustechVPN/clave-panel-wgeasy.txt (solo tu usuario puede leerla)."
echo "Listo: ya puedes entrar desde la app VenusTech Shield."
