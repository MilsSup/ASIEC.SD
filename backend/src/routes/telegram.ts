// backend/src/routes/telegram.ts
import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import { jwt } from 'hono/jwt';
import { randomBytes } from 'node:crypto';
import { prisma } from '../lib/client.js';
import { getJwtSecret } from '../lib/jwt.js';
import { getBotUsername } from '../lib/telegram.js';

export const telegramRouter = new OpenAPIHono();

// Все руты требуют валидный JWT-токен
telegramRouter.use('/*', (c, next) => {
  const secret = getJwtSecret();
  return jwt({ secret, alg: 'HS256' })(c, next);
});

// GET /api/telegram/status привязан ли Telegram у текущего пользователя
const statusRoute = createRoute({
  method: 'get', path: '/status',
  security: [{ bearerAuth: [] }],
  responses: { 200: { description: 'Статус привязки', content: { 'application/json': { schema: z.object({ linked: z.boolean() }) } } } },
});

telegramRouter.openapi(statusRoute, async (c) => {
  const payload = c.get('jwtPayload') as { sub: number };
  const user = await prisma.user.findUnique({ where: { id: payload.sub }, select: { telegramChatId: true } });
  return c.json({ linked: !!user?.telegramChatId });
});

// POST /api/telegram/link-code сгенерировать одноразовый код и ссылку на бота
const linkCodeRoute = createRoute({
  method: 'post', path: '/link-code',
  security: [{ bearerAuth: [] }],
  responses: {
    200: { description: 'Код и ссылка для привязки', content: { 'application/json': { schema: z.object({ code: z.string(), url: z.string().nullable(), botUsername: z.string().nullable() }) } } },
    404: { description: 'Пользователь не найден' },
    409: { description: 'Telegram уже привязан' },
  },
});

telegramRouter.openapi(linkCodeRoute, async (c) => {
  const payload = c.get('jwtPayload') as { sub: number };
  const user = await prisma.user.findUnique({ where: { id: payload.sub } });
  if (!user) {
    return c.json({ error: 'Пользователь не найден' }, 404 as const);
  }
  if (user.telegramChatId) {
    return c.json({ error: 'Telegram уже привязан' }, 409 as const);
  }

  const code = randomBytes(16).toString('hex');
  await prisma.user.update({ where: { id: user.id }, data: { linkCode: code } });

  const botUsername = await getBotUsername();
  const url = botUsername ? `https://t.me/${botUsername}?start=${code}` : null;
  return c.json({ code, url, botUsername }, 200 as const);
});

// DELETE /api/telegram/link отвязать Telegram от текущего аккаунта
const unlinkRoute = createRoute({
  method: 'delete', path: '/link',
  security: [{ bearerAuth: [] }],
  responses: {
    200: { description: 'Telegram отвязан', content: { 'application/json': { schema: z.object({ linked: z.boolean() }) } } },
    404: { description: 'Пользователь не найден' },
  },
});

telegramRouter.openapi(unlinkRoute, async (c) => {
  const payload = c.get('jwtPayload') as { sub: number };
  const user = await prisma.user.findUnique({ where: { id: payload.sub } });
  if (!user) {
    return c.json({ error: 'Пользователь не найден' }, 404 as const);
  }

  await prisma.user.update({ where: { id: user.id }, data: { telegramChatId: null, linkCode: null } });
  return c.json({ linked: false }, 200 as const);
});
