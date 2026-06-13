#!/bin/sh
# Перед запуском применяем миграции к базе
set -e

npx prisma migrate deploy

case "$1" in
  api)
    exec npx tsx src/index.ts
    ;;
  bot)
    exec npx tsx src/bot/index.ts
    ;;
  *)
    exec "$@"
    ;;
esac
