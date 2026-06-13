# Контекст сборки - корень репозитория (backend зависит от пакетов,
# установленных в корневой node_modules: better-sqlite3, @prisma/adapter-better-sqlite3 и др.)
FROM node:22-bookworm-slim AS base
WORKDIR /app

# OpenSSL нужен Prisma engine
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

# Корневые зависимости
COPY package.json package-lock.json ./
RUN npm install

# Зависимости backend
COPY backend/package.json backend/package-lock.json ./backend/
RUN npm install --prefix backend

# Исходный код и Prisma-схема
COPY backend ./backend

WORKDIR /app/backend
RUN npx prisma generate

ENV NODE_ENV=production

RUN chmod +x /app/backend/docker-entrypoint.sh

ENTRYPOINT ["./docker-entrypoint.sh"]

EXPOSE 3000
CMD ["api"]
