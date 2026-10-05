import { PrismaClient } from '@prisma/client';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import Database from 'better-sqlite3';
import 'dotenv/config';

// Инициализация базы данных через адаптер.
// DATABASE_URL (формат "file:<путь>") позволяет переопределить путь к файлу БД,
// например для монтирования постоянного volume в Docker.
const dbPath = (process.env.DATABASE_URL ?? 'file:./prisma/dev.db').replace(/^file:/, '');
const sqlite = new Database(dbPath);

// Снижаем конфликты блокировок при конкурентном доступе
sqlite.pragma('journal_mode = WAL');
sqlite.pragma('busy_timeout = 5000');

const adapter = new PrismaBetterSqlite3({ url: dbPath });
export const prisma = new PrismaClient({ adapter });