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
# El contenedor corre con tu usuario, para poder escribir en data/:
grep -q '^PUID=' .env || printf 'PUID=%s\nPGID=%s\n' "$(id -u)" "$(id -g)" >> .env
chmod 600 .env secretos/clave
```

## 4. Levantar la web

```bash
docker compose up -d --build
docker compose ps                  # debe decir "healthy" al cabo de unos segundos
docker compose exec web node --disable-warning=ExperimentalWarning scripts/crear-admin.mjs   # tu usuario del panel
```

## 5. Nginx + HTTPS

> **¿Tu Nginx corre en Docker** (otro contenedor ocupa los puertos 80/443)? Usa la sección
> [Nginx en Docker](#nginx-en-docker) de abajo en lugar de esta.


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

## Cambiar al dominio definitivo (venustechfp.com con Cloudflare)

El dominio usa Cloudflare como DNS. En Cloudflare → **DNS**, crea dos registros `A` hacia la IP del VPS
(`venustechfp.com` y `www`). Mientras sacas el certificado déjalos en **"Solo DNS"** (nube gris).

```bash
cd ~/VenusTech
nano .env                                   # SITE_URL=https://www.venustechfp.com
docker compose up -d --build

D=~/docker/nginx; H=www.venustechfp.com; H2=venustechfp.com
# 1) HTTP temporal para validar los dos nombres
sed "s/server_name TU_DOMINIO;/server_name $H $H2;/; s/TU_DOMINIO/$H/g" deploy/nginx-docker-http.conf > $D/conf.d/venustech.conf
docker exec nginx nginx -t && docker exec nginx nginx -s reload
# 2) Un certificado para ambos
docker run --rm -v $D/certbot/conf:/etc/letsencrypt -v $D/certbot/www:/var/www/certbot certbot/certbot \
  certonly --webroot -w /var/www/certbot -d $H -d $H2 -m venustech47@gmail.com --agree-tos --no-eff-email
# 3) HTTPS definitivo (venustechfp.com redirige a www)
sed "s/server_name TU_DOMINIO;/server_name $H $H2;/; s/TU_DOMINIO/$H/g" deploy/nginx-docker.conf > $D/conf.d/venustech.conf
# 4) IP real de los visitantes detrás de Cloudflare (analítica y bloqueo de intentos de login)
cp deploy/nginx-cloudflare.conf $D/conf.d/
docker exec nginx nginx -t && docker exec nginx nginx -s reload
```

Después, en Cloudflare:

- **DNS**: puedes volver a activar la nube naranja (proxy). La renovación del certificado sigue funcionando.
- **SSL/TLS → Modo**: **Completo (estricto)**. Con "Flexible" la web entraría en un bucle de redirecciones.
- El plan gratis de Cloudflare no deja subir archivos de más de **100 MB**: comprime los videos antes de subirlos al panel.
- Si activas "Bot Fight Mode", revisa que Instagram pueda descargar las imágenes (si falla al compartir, desactívalo).

Por último, en Google Search Console agrega la propiedad `https://www.venustechfp.com` y envía `/sitemap-index.xml`.

## Nginx en Docker

Si ya tienes un contenedor Nginx publicando los puertos 80/443 (por ejemplo `nginx`, con su configuración en
`~/docker/nginx/conf.d` y certbot en `~/docker/nginx/certbot`), **no expongas el puerto 4321**: une la web a la
red de ese contenedor.

```bash
cd ~/VenusTech
bash scripts/conectar-proxy.sh nginx        # crea docker-compose.override.yml
docker compose up -d --build

D=~/docker/nginx; H=tu-dominio             # ej.: 161-97-83-13.sslip.io
# 1) HTTP temporal para validar el dominio
sed "s/TU_DOMINIO/$H/g" deploy/nginx-docker-http.conf > $D/conf.d/venustech.conf
docker exec nginx nginx -t && docker exec nginx nginx -s reload
# 2) Certificado gratuito
docker run --rm -v $D/certbot/conf:/etc/letsencrypt -v $D/certbot/www:/var/www/certbot certbot/certbot \
  certonly --webroot -w /var/www/certbot -d $H -m venustech47@gmail.com --agree-tos --no-eff-email
# 3) Configuración definitiva con HTTPS
sed "s/TU_DOMINIO/$H/g" deploy/nginx-docker.conf > $D/conf.d/venustech.conf
docker exec nginx nginx -t && docker exec nginx nginx -s reload
```

Renovación automática del certificado (agrégalo con `crontab -e`):

```
0 4 * * 1 docker run --rm -v $HOME/docker/nginx/certbot/conf:/etc/letsencrypt -v $HOME/docker/nginx/certbot/www:/var/www/certbot certbot/certbot renew --quiet && docker exec nginx nginx -s reload
```
