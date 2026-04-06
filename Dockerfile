# ── Stage 1: Build ────────────────────────────────────────────────────────────
FROM node:20-slim AS builder

# Dependencias para compilar better-sqlite3 (módulo nativo)
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

# Instalar pnpm
RUN npm install -g pnpm@9

WORKDIR /app

# Copiar manifiestos primero (cache eficiente)
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY lib/db/package.json ./lib/db/
COPY lib/api-zod/package.json ./lib/api-zod/
COPY lib/api-spec/package.json ./lib/api-spec/
COPY artifacts/api-server/package.json ./artifacts/api-server/
COPY artifacts/necio-app/package.json ./artifacts/necio-app/

# Instalar todas las dependencias (incluyendo devDeps para builds)
RUN pnpm install --frozen-lockfile

# Copiar el resto del código fuente
COPY . .

# Build del frontend (output: artifacts/necio-app/dist/public)
RUN cd artifacts/necio-app && NODE_ENV=production PORT=3000 BASE_PATH=/ pnpm run build

# Build del API server (output: artifacts/api-server/dist/index.mjs)
RUN cd artifacts/api-server && pnpm run build

# ── Stage 2: Runtime ───────────────────────────────────────────────────────────
FROM node:20-slim AS runtime

RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*
RUN npm install -g pnpm@9

WORKDIR /app

# Solo manifiestos de producción
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY lib/db/package.json ./lib/db/
COPY lib/api-zod/package.json ./lib/api-zod/
COPY lib/api-spec/package.json ./lib/api-spec/
COPY artifacts/api-server/package.json ./artifacts/api-server/
COPY artifacts/necio-app/package.json ./artifacts/necio-app/

# Solo dependencias de producción
RUN pnpm install --frozen-lockfile --prod

# Copiar artefactos compilados del builder
COPY --from=builder /app/artifacts/api-server/dist ./artifacts/api-server/dist
COPY --from=builder /app/artifacts/necio-app/dist ./artifacts/necio-app/dist

# Directorio persistente para SQLite
RUN mkdir -p /data

ENV NODE_ENV=production
ENV PORT=8080
ENV DB_PATH=/data/necio_cobranza.db
ENV FRONTEND_DIST=/app/artifacts/necio-app/dist/public

EXPOSE 8080

CMD ["node", "artifacts/api-server/dist/index.mjs"]
