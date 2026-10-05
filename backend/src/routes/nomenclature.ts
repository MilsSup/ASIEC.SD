import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import { HTTPException } from 'hono/http-exception';
import { prisma } from '../lib/client.js';
import { jwt } from 'hono/jwt';
import { getJwtSecret } from '../lib/jwt.js';
import { NomenclatureSchema } from '../lib/responseSchemas.js';

export const nomenclatureRouter = new OpenAPIHono();

nomenclatureRouter.use('/*', (c, next) => {
  const secret = getJwtSecret();
  return jwt({ secret, alg: 'HS256' })(c, next);
});

// GET /nomenclature/units — список единиц измерения
const getUnitsRoute = createRoute({
  method: 'get',
  path: '/units',
  security: [{ bearerAuth: [] }],
  responses: {
    200: {
      description: 'Список единиц измерения',
      content: { 'application/json': { schema: z.array(z.object({ id: z.number(), shortName: z.string(), fullName: z.string() })) } },
    },
  },
});

nomenclatureRouter.openapi(getUnitsRoute, async (c) => {
  const units = await prisma.unit.findMany({ orderBy: { fullName: 'asc' } });
  return c.json(units);
});

// GET /nomenclature список с поиском
const getNomenclatureRoute = createRoute({
  method: 'get',
  path: '/',
  security: [{ bearerAuth: [] }],
  request: {
    query: z.object({ search: z.string().optional() }),
  },
  responses: {
    200: {
      description: 'Список номенклатуры',
      content: { 'application/json': { schema: z.array(NomenclatureSchema) } },
    },
  },
});

nomenclatureRouter.openapi(getNomenclatureRoute, async (c) => {
  const { search } = c.req.valid('query');

  const items = await prisma.nomenclature.findMany({
    where: search
      ? { name: { contains: search } }
      : undefined,
    include: { unit: true },
    orderBy: { name: 'asc' },
  });

  return c.json(items);
});

// POST /nomenclature создать новую позицию
const createNomenclatureRoute = createRoute({
  method: 'post',
  path: '/',
  security: [{ bearerAuth: [] }],
  request: {
    body: {
      content: {
        'application/json': {
          schema: z.object({
            name: z.string().min(2, 'Введите название'),
            article: z.string().optional(),
            unitId: z.number(),
            price: z.number().optional(),
          }),
        },
      },
    },
  },
  responses: {
    201: { description: 'Создано', content: { 'application/json': { schema: NomenclatureSchema } } },
  },
});

nomenclatureRouter.openapi(createNomenclatureRoute, async (c) => {
  const { name, article, unitId, price } = c.req.valid('json');

  try {
    const item = await prisma.nomenclature.create({
      data: { name, article, unitId, price: price ?? 0 },
      include: { unit: true },
    });
    return c.json(item, 201 as const);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new HTTPException(500, { message });
  }
});

// PATCH /nomenclature/:id — редактировать позицию справочника
const updateNomenclatureRoute = createRoute({
  method: 'patch',
  path: '/{id}',
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({ id: z.string() }),
    body: {
      content: {
        'application/json': {
          schema: z.object({
            name: z.string().min(2, 'Введите название'),
            article: z.string().nullable().optional(),
            unitId: z.number(),
            price: z.number().min(0),
          }),
        },
      },
    },
  },
  responses: {
    200: { description: 'Обновлено', content: { 'application/json': { schema: NomenclatureSchema } } },
    404: { description: 'Не найдено', content: { 'application/json': { schema: z.object({ error: z.string() }) } } },
  },
});

nomenclatureRouter.openapi(updateNomenclatureRoute, async (c) => {
  const { id } = c.req.valid('param');
  const { name, article, unitId, price } = c.req.valid('json');

  const existing = await prisma.nomenclature.findUnique({ where: { id: Number(id) } });
  if (!existing) {
    return c.json({ error: 'Позиция номенклатуры не найдена' }, 404 as const);
  }

  try {
    const item = await prisma.nomenclature.update({
      where: { id: Number(id) },
      data: { name, article: article ?? null, unitId, price },
      include: { unit: true },
    });
    return c.json(item, 200 as const);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new HTTPException(500, { message });
  }
});

// DELETE /nomenclature/:id — удалить позицию справочника
const deleteNomenclatureRoute = createRoute({
  method: 'delete',
  path: '/{id}',
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({ id: z.string() }),
  },
  responses: {
    200: { description: 'Удалено', content: { 'application/json': { schema: z.object({ ok: z.boolean() }) } } },
    404: { description: 'Не найдено', content: { 'application/json': { schema: z.object({ error: z.string() }) } } },
    409: { description: 'Используется', content: { 'application/json': { schema: z.object({ error: z.string() }) } } },
  },
});

nomenclatureRouter.openapi(deleteNomenclatureRoute, async (c) => {
  const { id } = c.req.valid('param');
  const nomenclatureId = Number(id);

  const existing = await prisma.nomenclature.findUnique({ where: { id: nomenclatureId } });
  if (!existing) {
    return c.json({ error: 'Позиция номенклатуры не найдена' }, 404 as const);
  }

  // Запрещаем удаление, если позиция используется в заявках или истории списаний —
  // это разрушит сметы и аудит. Складские остатки (inventory) удаляются каскадно.
  const [partsCount, writeOffsCount, stockOnHand] = await Promise.all([
    prisma.ticketPart.count({ where: { nomenclatureId } }),
    prisma.stockWriteOff.count({ where: { nomenclatureId } }),
    prisma.inventory.aggregate({ where: { nomenclatureId }, _sum: { quantity: true } }),
  ]);

  if (partsCount > 0) {
    return c.json({ error: 'Позиция используется в сметах заявок и не может быть удалена' }, 409 as const);
  }
  if (writeOffsCount > 0) {
    return c.json({ error: 'Позиция есть в истории списаний и не может быть удалена' }, 409 as const);
  }
  if ((stockOnHand._sum.quantity ?? 0) > 0) {
    return c.json({ error: 'На складе есть остатки этой позиции — сначала спишите или обнулите их' }, 409 as const);
  }

  await prisma.nomenclature.delete({ where: { id: nomenclatureId } });
  return c.json({ ok: true }, 200 as const);
});