FROM node:20-slim

# Dependencias para compilar better-sqlite3 (módulo nativo)
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

# Instalar pnpm
RUN npm install -g pnpm@9

WORKDIR /app

# Copiar todo el código
COPY . .

# Instalar dependencias
RUN pnpm install --no-frozen-lockfile

# Build del frontend
RUN cd artifacts/necio-app && NODE_ENV=production PORT=3000 BASE_PATH=/ pnpm run build

# Build del API server
RUN cd artifacts/api-server && pnpm run build

# Directorio persistente para SQLite
RUN mkdir -p /data

ENV NODE_ENV=production
ENV PORT=8080
ENV DB_PATH=/data/necio_cobranza.db
ENV FRONTEND_DIST=/app/artifacts/necio-app/dist/public

EXPOSE 8080

CMD ["node", "artifacts/api-server/dist/index.mjs"]
