// backend/src/routes/auth.ts
import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import bcrypt from 'bcryptjs';
import { sign } from 'hono/jwt';
import { prisma } from '../lib/client.js';
import { getJwtSecret } from '../lib/jwt.js';

export const authRouter = new OpenAPIHono();

// ─── Схемы данных ─────────────────────────────────────────────────────────────
const LoginSchema = z.object({
  login: z.string().min(3, 'Логин слишком короткий').openapi({ example: 'admin_user' }),
  password: z.string().min(6, 'Пароль должен быть от 6 символов').openapi({ example: 'password123' }),
});

const RegisterSchema = LoginSchema.extend({
  fullName: z.string().min(2, 'ФИО обязательно').openapi({ example: 'Иванов Иван Иванович' }),
});

const UserResponseSchema = z.object({
  id: z.number().openapi({ example: 1 }),
  login: z.string().openapi({ example: 'admin_user' }),
  fullName: z.string().openapi({ example: 'Иванов Иван Иванович' }),
  role: z.string().openapi({ example: 'INITIATOR' }),
});

// ─── Описание рутов (OpenAPI / Swagger) ─────────────────────────────────────
const registerRoute = createRoute({
  method: 'post',
  path: '/register',
  tags: ['Auth'],
  description: 'Регистрация нового пользователя',
  request: {
    body: {
      content: { 'application/json': { schema: RegisterSchema } },
    },
  },
  responses: {
    201: {
      description: 'Успешная регистрация',
      content: {
        'application/json': { schema: z.object({ message: z.string(), userId: z.number() }) },
      },
    },
    400: {
      description: 'Ошибка (пользователь уже существует)',
      content: {
        'application/json': { schema: z.object({ error: z.string() }) },
      },
    },
  },
});

const loginRoute = createRoute({
  method: 'post',
  path: '/login',
  tags: ['Auth'],
  description: 'Авторизация и получение JWT токена',
  request: {
    body: {
      content: { 'application/json': { schema: LoginSchema } },
    },
  },
  responses: {
    200: {
      description: 'Успешная авторизация',
      content: {
        'application/json': { schema: z.object({ token: z.string(), user: UserResponseSchema }) },
      },
    },
    401: {
      description: 'Неверный логин или пароль',
      content: {
        'application/json': { schema: z.object({ error: z.string() }) },
      },
    },
  },
});

// ─── Обработчики ──────────────────────────────────────────────────────────────
authRouter.openapi(registerRoute, async (c) => {
  const { login, password, fullName } = c.req.valid('json');

  const existingUser = await prisma.user.findUnique({ where: { login } });
  if (existingUser) {
    return c.json({ error: 'Пользователь с таким логином уже существует' }, 400);
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const user = await prisma.user.create({
    data: {
      login,
      passwordHash,
      fullName,
      role: 'INITIATOR',
    },
  });

  return c.json({ message: 'Пользователь успешно зарегистрирован', userId: user.id }, 201);
});

authRouter.openapi(loginRoute, async (c) => {
  const { login, password } = c.req.valid('json');

  const user = await prisma.user.findUnique({ where: { login } });
  if (!user) {
    return c.json({ error: 'Неверный логин или пароль' }, 401 as const);
  }

  const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
  if (!isPasswordValid) {
    return c.json({ error: 'Неверный логин или пароль' }, 401 as const);
  }

  const payload = {
    sub: user.id,
    login: user.login,
    role: user.role,
    exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24, // Токен живет 24 часа
  };

  const secret = getJwtSecret();
  const token = await sign(payload, secret);

  return c.json({
    token,
    user: {
      id: user.id,
      login: user.login,
      fullName: user.fullName,
      role: user.role,
    },
  }, 200 as const);
});