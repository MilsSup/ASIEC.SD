#!/bin/sh
set -e

# Миграции применяет только основной сервис (api): он стартует первым (bot и studio
# зависят от него). Бот и studio подключаются к уже готовой базе и не запускают
# migrate deploy, чтобы не конкурировать за блокировку файла SQLite (database is locked).
if [ "$1" = "api" ]; then
  npx prisma migrate deploy
fi

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
