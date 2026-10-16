# Despliegue en el VPS (Ubuntu + Docker + Nginx)

La web corre en un contenedor Docker. Nginx la publica a internet con HTTPS.
Los datos (base de datos e imágenes) quedan en `~/VenusTech/data` del VPS.

## 0. Antes de empezar

- La **IP** del VPS y acceso por SSH.
- Un **dominio** apuntando a esa IP (registro `A`). Si aún no tienes dominio, usa uno temporal
  gratuito: `https://IP-CON-GUIONES.sslip.io` (por ejemplo, para la IP `203.0.113.10` sería
  `203-0-113-10.sslip.io`). Funciona con HTTPS y luego lo cambias por el dominio real.

## 1. Preparar el servidor (una sola vez)

```bash
ssh root@TU_IP

# Actualizar e instalar lo necesario
apt update && apt upgrade -y
apt install -y git nginx certbot python3-certbot-nginx ufw
curl -fsSL https://get.docker.com | sh

# Firewall: solo SSH y web
ufw allow OpenSSH && ufw allow 'Nginx Full' && ufw --force enable

# Usuario para la web (no trabajar como root)
adduser --disabled-password --gecos "" venustech
usermod -aG docker venustech
```

## 2. Descargar el código (repositorio privado)

En el VPS, crea una llave de solo lectura para el repositorio:

```bash
su - venustech
ssh-keygen -t ed25519 -N "" -f ~/.ssh/github_venustech -C "vps-venustech"
cat ~/.ssh/github_venustech.pub     # copia esta línea
```

En GitHub: repositorio → *Settings* → *Deploy keys* → *Add deploy key* → pega la línea (sin marcar "write").

```bash
cat >> ~/.ssh/config <<'EOF'
Host github.com
  IdentityFile ~/.ssh/github_venustech
EOF
git clone git@github.com:fjavierpared/VenusTech.git ~/VenusTech
cd ~/VenusTech
```

## 3. Secretos (desde TU computadora)

El `.env` y la llave de cifrado **no están en GitHub**. Cópialos desde tu computadora:

```bash
# En tu computadora, dentro de la carpeta del proyecto:
ssh venustech@TU_IP "mkdir -p ~/VenusTech/secretos ~/VenusTech/data"
scp .env venustech@TU_IP:~/VenusTech/.env
scp ~/.config/venustech/clave venustech@TU_IP:~/VenusTech/secretos/clave
```

En el VPS, ajusta la dirección pública y los permisos:

```bash
cd ~/VenusTech
nano .env                          # cambia SITE_URL=https://tu-dominio (o el de sslip.io)
chmod 600 .env secretos/clave
sudo chown -R 1000:1000 data secretos   # el contenedor corre con el usuario 1000
```

## 4. Levantar la web

```bash
docker compose up -d --build
docker compose ps                  # debe decir "healthy" al cabo de unos segundos
docker compose exec web node --disable-warning=ExperimentalWarning scripts/crear-admin.mjs   # tu usuario del panel
```

## 5. Nginx + HTTPS

```bash
sudo cp deploy/nginx-venustech.conf /etc/nginx/sites-available/venustech
sudo sed -i 's/TU_DOMINIO/tu-dominio.com/' /etc/nginx/sites-available/venustech
sudo ln -s /etc/nginx/sites-available/venustech /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d tu-dominio.com     # agrega HTTPS y lo renueva solo
```

Abre `https://tu-dominio.com` y `https://tu-dominio.com/admin`.

## Actualizar la web después de un cambio

En tu computadora: `git push`. En el VPS:

```bash
cd ~/VenusTech && git pull && docker compose up -d --build
```

## Respaldos

Lo único que no está en GitHub es `data/` (más `.env` y `secretos/clave`). Respaldo diario a las 3 a. m.:

```bash
mkdir -p ~/respaldos
crontab -e
# agrega esta línea:
0 3 * * * cd ~/VenusTech && sqlite3 data/venustech.db ".backup data/respaldo.db" 2>/dev/null; tar czf ~/respaldos/venustech-$(date +\%F).tgz data .env secretos && find ~/respaldos -mtime +14 -delete
```

(Si `sqlite3` no está instalado: `sudo apt install sqlite3`.) Descarga de vez en cuando esos `.tgz` a tu computadora.

## Cambiar al dominio definitivo

1. Apunta el dominio a la IP del VPS (registro `A`).
2. Cambia `SITE_URL` en `.env` y `server_name` en `/etc/nginx/sites-available/venustech`.
3. `docker compose up -d --build`, `sudo certbot --nginx -d tudominio.com`.
