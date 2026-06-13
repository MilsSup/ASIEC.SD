# АПЭК.SD - система управления заявками на ремонт/обслуживание/консультации в колледже АПЭК

Веб-кабинет (React) + API (Hono/Prisma) + Telegram-бот для подачи и обработки заявок:
инициаторы создают заявки, исполнители (ИТ-отдел) берут их в работу, руководитель видит сводки и отчёты.

## Состав проекта

- **backend/** - API на Hono + Prisma (SQLite через `better-sqlite3`) и Telegram-бот (Telegraf).
- **frontend/** - веб-кабинет на React + Vite + TailwindCSS.

## Переменные окружения

### `backend/.env`

Скопировать из `backend/.env.example` и заполнить:

| Переменная | Назначение |
|---|---|
| `DATABASE_URL` | путь к файлу SQLite, по умолчанию `file:./prisma/dev.db` |
| `JWT_SECRET` | секрет для подписи JWT-токенов |
| `TELEGRAM_BOT_TOKEN` | токен бота от @BotFather |
| `TELEGRAM_BOT_USERNAME` | username бота (для ссылки привязки `t.me/<bot>?start=<code>`); если не задан, то берётся через `getMe` |
| `CORS_ORIGIN` | origin фронтенда, разрешённый для CORS (по умолчанию `http://localhost:5173`) |
| `PORT` | порт API-сервера (по умолчанию `3000`) |

### `frontend/.env`

Скопировать из `frontend/.env.example`:

| Переменная | Назначение |
|---|---|
| `VITE_API_URL` | адрес backend API (по умолчанию `http://localhost:3000`) |

## Запуск локально (без Docker)

Нужны Node.js 22+ и npm.

1. Установить зависимости:
   ```bash
   npm install --prefix backend
   npm install --prefix frontend
   ```
2. Подготовить `backend/.env` (см. выше) и применить миграции:
   ```bash
   cd backend
   npx prisma migrate deploy
   ```
3. Запустить (каждое — в своём терминале):
   ```bash
   # API-сервер (http://localhost:3000, Swagger на /swagger)
   npm run dev --prefix backend

   # Telegram-бот
   npm run bot:dev --prefix backend

   # Веб-кабинет (http://localhost:5173)
   npm run dev --prefix frontend
   ```

> ВНИМАНИЕ `tsx watch` не перечитывает `.env` при его изменении — при правке `backend/.env`
> перезапустите оба процесса backend (`dev` и `bot:dev`).

### Тесты

```bash
npm test --prefix backend     # vitest, включает интеграционные тесты на доступ/ownership
npm test --prefix frontend    # vitest + React Testing Library
```

## Запуск через Docker

Требуется Docker (с Docker Compose v2).

```bash
npm run docker:up       # сборка и запуск всех сервисов в фоне
npm run docker:logs     # логи всех контейнеров
npm run docker:ps       # статус контейнеров
npm run docker:down     # остановить
npm run docker:restart  # пересобрать и перезапустить
npm run docker:reset    # остановить и удалить volume с БД (полный сброс данных)
```

Сервисы:

- **frontend** — http://localhost:5173 (nginx, статическая сборка)
- **backend** — http://localhost:3000 (API + Swagger на `/swagger`)
- **bot** — Telegram-бот (использует тот же образ backend, без открытых портов)

Backend и bot используют общий именованный volume `db_data` для файла SQLite,
секреты (токен бота, JWT-секрет) подтягиваются из `backend/.env`.
При старте автоматически выполняется `prisma migrate deploy`.

## Структура ролей

| Роль | Доступ |
|---|---|
| `INITIATOR` | веб-кабинет (`/portal`) и бот — создание заявок, отслеживание статуса |
| `EXECUTOR` | веб-кабинет (`/kanban`) и бот — обработка заявок своей специализации/корпуса |
| `MANAGER` | веб-кабинет (`/dashboard`, `/kanban`) — сводки, отчёты, склад. Бот недоступен |
