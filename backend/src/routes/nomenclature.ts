import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import { prisma } from '../lib/client.js';
import { jwt } from 'hono/jwt';
import { getJwtSecret } from '../lib/jwt.js';
import { NomenclatureSchema } from '../lib/responseSchemas.js';

export const nomenclatureRouter = new OpenAPIHono();

nomenclatureRouter.use('/*', (c, next) => {
  const secret = getJwtSecret();
  return jwt({ secret, alg: 'HS256' })(c, next);
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

  const item = await prisma.nomenclature.create({
    data: { name, article, unitId, price: price ?? 0 },
    include: { unit: true },
  });

  return c.json(item, 201 as const);
});