FROM node:20-slim

# Instalar pnpm y herramientas de PostgreSQL (para backups)
RUN apt-get update && apt-get install -y postgresql-client && rm -rf /var/lib/apt/lists/*
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

ENV NODE_ENV=production
ENV PORT=8080
ENV DATABASE_URL=""
ENV FRONTEND_DIST=/app/artifacts/necio-app/dist/public

EXPOSE 8080

CMD ["sh", "-c", "cd /app/lib/db && pnpm run push --config ./drizzle.config.ts && cd /app && node artifacts/api-server/dist/index.mjs"]
