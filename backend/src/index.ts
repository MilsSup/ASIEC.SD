// backend/src/index.ts
import 'dotenv/config';
import { serve } from '@hono/node-server';
import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import { swaggerUI } from '@hono/swagger-ui';
import { prisma } from './lib/client.js';
import { cors } from 'hono/cors';
import { ticketsRouter } from './routes/tickets.js';
import { nomenclatureRouter } from './routes/nomenclature.js';
import { managerRouter } from './routes/manager.js';
import { authRouter } from './routes/auth.js';
import { telegramRouter } from './routes/telegram.js';

export const app = new OpenAPIHono();

app.use('/*', cors({ origin: process.env.CORS_ORIGIN || 'http://localhost:5173' }));

// OpenAPI-спецификация и Swagger
app.doc('/openapi.json', {
  openapi: '3.0.0',
  info: {
    version: '1.0.0',
    title: 'Diplom API',
    description: 'API для системы управления заявками',
  },
});
app.get('/swagger', swaggerUI({ url: '/openapi.json' }));

const healthRoute = createRoute({
  method: 'get',
  path: '/health',
  description: 'Проверка статуса сервера и связи с БД',
  responses: {
    200: {
      description: 'Успешный ответ',
      content: {
        'application/json': {
          schema: z.object({
            status: z.string(),
            ticketCount: z.number(),
          }),
        },
      },
    },
  },
});

app.openapi(healthRoute, async (c) => {
  const tickets = await prisma.ticket.count();
  return c.json({ status: 'ok', ticketCount: tickets }, 200);
});

app.route('/api/auth', authRouter);
app.route('/api/tickets', ticketsRouter);
app.route('/api/nomenclature', nomenclatureRouter);
app.route('/api/manager', managerRouter);
app.route('/api/telegram', telegramRouter);

// HTTP-сервер поднимаем только при обычном запуске, не в тестах (vitest задаёт NODE_ENV=test)
if (process.env.NODE_ENV !== 'test') {
  serve({
    fetch: app.fetch,
    port: Number(process.env.PORT) || 3000
  }, (info) => {
    console.log(`🚀 Сервер запущен: http://localhost:${info.port}`);
    console.log(`📚 Swagger документация: http://localhost:${info.port}/swagger`);
  });
}