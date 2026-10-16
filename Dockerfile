# ---------- 1) Construcción ----------
FROM node:22-slim AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
# Dirección pública de la web (dominio o temporal). Se pasa desde docker-compose.
ARG SITE_URL
ENV SITE_URL=${SITE_URL}
RUN npm run build && npm prune --omit=dev

# ---------- 2) Imagen final (solo lo necesario para ejecutar) ----------
FROM node:22-slim
WORKDIR /app

ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=4321 \
    DATA_DIR=/data \
    TRUST_PROXY=1 \
    VT_KEY_FILE=/run/secrets/venustech_clave

COPY --from=build /app/package.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/scripts ./scripts

RUN mkdir -p /data && chown node:node /data
USER node

EXPOSE 4321
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:4321/robots.txt').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "--disable-warning=ExperimentalWarning", "dist/server/entry.mjs"]
