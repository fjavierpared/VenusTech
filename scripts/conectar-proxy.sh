#!/usr/bin/env bash
# Une la web a la red Docker del contenedor Nginx (por defecto "nginx"),
# creando docker-compose.override.yml (propio de cada servidor, no va a git).
# Uso: bash scripts/conectar-proxy.sh [nombre-del-contenedor-nginx]
set -euo pipefail
cd "$(dirname "$0")/.."

PROXY="${1:-nginx}"
RED=$(docker inspect "$PROXY" --format '{{range $k, $v := .NetworkSettings.Networks}}{{$k}} {{end}}' | awk '{print $1}')

# La red "bridge" por defecto no permite llamar a los contenedores por su nombre: se crea una propia
if [ -z "$RED" ] || [ "$RED" = "bridge" ] || [ "$RED" = "host" ]; then
  RED=proxy
  docker network inspect "$RED" >/dev/null 2>&1 || docker network create "$RED" >/dev/null
  docker network connect "$RED" "$PROXY" 2>/dev/null || true
fi

cat > docker-compose.override.yml <<EOF
# Generado por scripts/conectar-proxy.sh — une la web a la red de "$PROXY"
services:
  web:
    networks: [proxy]
networks:
  proxy:
    external: true
    name: $RED
EOF
echo "Listo: venustech-web usará la red \"$RED\" (la misma de $PROXY)."
